// src/services/ReviewService.js
// Phase 5: Switched from Mongoose to Prisma. Shadow writes removed.
// MongoDB sessions replaced with prisma.$transaction(). No indexed* fields in PG schema.
// auditHistory in NonProjectService is JSONB — append via fetch+splice pattern inside tx.
// serviceType in changes is stored as Chinese string and must be translated to PG enum member.

import prisma from '../utils/prismaClient.js';
import { IDGenerator } from '../utils/idUtils.js';
import { SERVICE_TYPE_TO_PG } from '../utils/serializer.js';

class ReviewService {
  /**
   * Resolve audit log by auditId or applicationId (most recent application_review).
   * @private
   */
  static async resolveReviewAuditLog(reviewIdOrApplicationId) {
    let auditLog = await prisma.auditLog.findFirst({
      where: { auditId: reviewIdOrApplicationId },
    });
    if (auditLog) return auditLog;

    auditLog = await prisma.auditLog.findFirst({
      where: { targetId: reviewIdOrApplicationId, action: 'application_review' },
      orderBy: { timestamp: 'desc' },
    });
    return auditLog || null;
  }

  /**
   * 审核申请（通用方法）
   */
  static async reviewApplication(applicationId, reviewData, reviewer) {
    try {
      console.log('开始审核申请:', { applicationId, result: reviewData.result, reviewer: reviewer.id });

      const application = await this.validateApplicationForReview(applicationId);

      let reviewResult;
      switch (application.applicationType) {
        case 'create':
          reviewResult = await this.reviewCreateApplication(application, reviewData, reviewer);
          break;
        case 'update':
          reviewResult = await this.reviewUpdateApplication(application, reviewData, reviewer);
          break;
        case 'delete':
          reviewResult = await this.reviewDeleteApplication(application, reviewData, reviewer);
          break;
        default:
          throw new Error(`未知的申请类型: ${application.applicationType}`);
      }

      console.log('审核完成:', { applicationId, result: reviewData.result, modifiedId: reviewResult.modifiedId });
      return reviewResult;
    } catch (error) {
      console.error('审核申请失败:', error);
      throw error;
    }
  }

  /**
   * 验证申请是否可审核
   * @private
   */
  static async validateApplicationForReview(applicationId) {
    const application = await prisma.serviceApplication.findFirst({
      where: { applicationId, status: 'pending' },
    });

    if (!application) {
      throw new Error(`申请不存在或已被处理: ${applicationId}`);
    }
    if (application.expiresAt && new Date(application.expiresAt) < new Date()) {
      throw new Error(`申请已过期: ${applicationId}`);
    }
    return application;
  }

  /**
   * 审核创建申请
   * @private
   */
  static async reviewCreateApplication(application, reviewData, reviewer) {
    return await prisma.$transaction(async (tx) => {
      let modifiedId = null;
      let serviceRecord = null;

      if (reviewData.result === 'approved') {
        const serviceId = await IDGenerator.generateServiceId(application.volunteerId);
        const changesData = this.extractDataFromChanges(
          Array.isArray(application.changes) ? application.changes : []
        );
        const auditEntryId = await IDGenerator.generateAuditId(reviewer.id);

        serviceRecord = await tx.nonProjectService.create({
          data: {
            serviceId,
            volunteerId: application.volunteerId,
            volunteerName: application.volunteerName,
            serviceDate: new Date(changesData.serviceDate),
            serviceType: SERVICE_TYPE_TO_PG[changesData.serviceType] || changesData.serviceType,
            duration: parseFloat(changesData.duration),
            description: changesData.description,
            auditHistory: [
              {
                auditId: auditEntryId,
                auditTime: new Date().toISOString(),
                auditResult: 'approved',
                reviewerId: reviewer.id,
                reviewerName: reviewer.name,
                auditNote: reviewData.notes || '审核通过',
                applicationId: application.applicationId,
              },
            ],
            isActive: true,
          },
        });
        modifiedId = serviceId;

        await this.updateVolunteerStatistics(application.volunteerId, tx);
      }

      await tx.serviceApplication.update({
        where: { applicationId: application.applicationId },
        data: { status: reviewData.result, reviewNotes: reviewData.notes || '', updatedAt: new Date() },
      });

      await this.createAuditLog({ tx, application, reviewData, reviewer, modifiedId });

      return {
        success: true,
        applicationId: application.applicationId,
        result: reviewData.result,
        modifiedId,
        serviceRecord: serviceRecord ? this.sanitizeServiceRecord(serviceRecord) : null,
      };
    });
  }

  /**
   * 审核更新申请
   * @private
   */
  static async reviewUpdateApplication(application, reviewData, reviewer) {
    return await prisma.$transaction(async (tx) => {
      const targetRecord = await tx.nonProjectService.findFirst({
        where: { serviceId: application.targetId, isActive: true },
      });

      if (!targetRecord) {
        throw new Error(`目标服务记录不存在: ${application.targetId}`);
      }

      const modifiedId = application.targetId;
      let updatedRecord = null;

      if (reviewData.result === 'approved') {
        const changes = Array.isArray(application.changes) ? application.changes : [];
        const oldValues = {};
        const updateData = {};

        for (const change of changes) {
          oldValues[change.field] = targetRecord[change.field];
          if (change.field === 'serviceType') {
            updateData[change.field] = SERVICE_TYPE_TO_PG[change.to] || change.to;
          } else if (change.field === 'serviceDate') {
            updateData[change.field] = new Date(change.to);
          } else {
            updateData[change.field] = change.to;
          }
        }

        const auditEntryId = await IDGenerator.generateAuditId(reviewer.id);
        const currentHistory = Array.isArray(targetRecord.auditHistory) ? targetRecord.auditHistory : [];
        const newHistory = [
          ...currentHistory,
          {
            auditId: auditEntryId,
            auditTime: new Date().toISOString(),
            auditResult: 'approved',
            reviewerId: reviewer.id,
            reviewerName: reviewer.name,
            auditNote: reviewData.notes || '审核通过',
            applicationId: application.applicationId,
            oldValues,
          },
        ];

        updatedRecord = await tx.nonProjectService.update({
          where: { serviceId: targetRecord.serviceId },
          data: { ...updateData, auditHistory: newHistory, updatedAt: new Date() },
        });

        const changesData = this.extractDataFromChanges(changes);
        if (changesData.duration !== undefined && changesData.duration !== oldValues.duration) {
          await this.updateVolunteerStatistics(application.volunteerId, tx);
        }
      }

      await tx.serviceApplication.update({
        where: { applicationId: application.applicationId },
        data: { status: reviewData.result, reviewNotes: reviewData.notes || '', updatedAt: new Date() },
      });

      await this.createAuditLog({ tx, application, reviewData, reviewer, modifiedId });

      return {
        success: true,
        applicationId: application.applicationId,
        result: reviewData.result,
        modifiedId,
        targetRecord: reviewData.result === 'approved' ? this.sanitizeServiceRecord(updatedRecord) : null,
      };
    });
  }

  /**
   * 审核删除申请
   * @private
   */
  static async reviewDeleteApplication(application, reviewData, reviewer) {
    return await prisma.$transaction(async (tx) => {
      const targetRecord = await tx.nonProjectService.findFirst({
        where: { serviceId: application.targetId, isActive: true },
      });

      if (!targetRecord) {
        throw new Error(`目标服务记录不存在: ${application.targetId}`);
      }

      const modifiedId = application.targetId;
      let updatedRecord = null;

      if (reviewData.result === 'approved') {
        const auditEntryId = await IDGenerator.generateAuditId(reviewer.id);
        updatedRecord = await tx.nonProjectService.update({
          where: { serviceId: targetRecord.serviceId },
          data: {
            isActive: false,
            auditHistory: [
              {
                auditId: auditEntryId,
                auditTime: new Date().toISOString(),
                auditResult: 'approved',
                reviewerId: reviewer.id,
                reviewerName: reviewer.name,
                auditNote: reviewData.notes || '审核通过，记录已删除',
                applicationId: application.applicationId,
              },
            ],
            updatedAt: new Date(),
          },
        });

        await this.updateVolunteerStatistics(application.volunteerId, tx);
      }

      await tx.serviceApplication.update({
        where: { applicationId: application.applicationId },
        data: { status: reviewData.result, reviewNotes: reviewData.notes || '', updatedAt: new Date() },
      });

      await this.createAuditLog({ tx, application, reviewData, reviewer, modifiedId });

      return {
        success: true,
        applicationId: application.applicationId,
        result: reviewData.result,
        modifiedId,
        targetRecord: reviewData.result === 'approved' ? this.sanitizeServiceRecord(updatedRecord) : null,
      };
    });
  }

  /**
   * 批量审核申请
   */
  static async batchReviewApplications(reviewRequests, reviewer) {
    console.log('开始批量审核:', { count: reviewRequests.length, reviewer: reviewer.id });

    const results = [];
    for (const request of reviewRequests) {
      try {
        const result = await this.reviewApplication(request.applicationId, request.reviewData, reviewer);
        results.push({ success: true, applicationId: request.applicationId, ...result });
      } catch (error) {
        results.push({ success: false, applicationId: request.applicationId, error: error.message });
      }
    }

    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log('批量审核完成:', { total: reviewRequests.length, succeeded, failed });
    return {
      results,
      summary: {
        total: reviewRequests.length,
        succeeded,
        failed,
        successRate: (succeeded / reviewRequests.length * 100).toFixed(2) + '%',
      },
    };
  }

  // ========== 辅助方法 ==========

  static extractDataFromChanges(changes) {
    const result = {};
    for (const change of changes) {
      result[change.field] = change.to;
    }
    return result;
  }

  /**
   * 更新志愿者统计（nonProjectHours, nonProjectCount, activityLevel）
   * @param {string} volunteerId - 志愿者域ID (e.g. PG-0001)
   * @param {object} tx - Prisma transaction client (defaults to global prisma)
   * @private
   */
  static async updateVolunteerStatistics(volunteerId, tx = prisma) {
    try {
      const agg = await tx.nonProjectService.aggregate({
        where: { volunteerId, isActive: true },
        _sum: { duration: true },
        _count: { id: true },
      });

      const totalHours = agg._sum.duration ?? 0;
      const totalCount = agg._count.id ?? 0;
      const activityLevel = totalHours >= 100 ? 'HIGH' : totalHours >= 30 ? 'MEDIUM' : 'LOW';

      await tx.volunteer.updateMany({
        where: { volunteerId },
        data: { nonProjectHours: totalHours, nonProjectCount: totalCount, activityLevel },
      });

      console.log(`志愿者统计已更新: ${volunteerId}`);
    } catch (error) {
      console.error(`更新志愿者统计失败 (${volunteerId}):`, error);
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * 创建审计日志
   * @private
   */
  static async createAuditLog({ tx = prisma, application, reviewData, reviewer, modifiedId }) {
    const auditId = await IDGenerator.generateAuditId(reviewer.id);
    const submitter = application.submittedBy || {};

    await tx.auditLog.create({
      data: {
        auditId,
        targetType: 'ServiceApplication',
        targetId: application.applicationId,
        action: 'application_review',
        actionDetails: {
          applicationType: application.applicationType,
          reviewResult: reviewData.result,
          reviewNote: reviewData.notes || (reviewData.result === 'approved' ? '审核通过' : '审核拒绝'),
        },
        modifiedId: modifiedId || null,
        changes: Array.isArray(application.changes) ? application.changes : [],
        operator: { id: reviewer.id, name: reviewer.name, role: reviewer.role },
        submitter: { id: submitter.id, name: submitter.name, role: submitter.role },
      },
    });
    console.log(`审计日志已创建: ${auditId}`);
  }

  /**
   * 清理服务记录对象（Prisma 返回的已是普通对象）
   * @private
   */
  static sanitizeServiceRecord(record) {
    if (!record) return null;
    return { ...record };
  }

  /**
   * 重新开启已拒绝的申请
   */
  static async reopenReview(reviewId, reviewer) {
    try {
      const auditLog = await this.resolveReviewAuditLog(reviewId);
      if (!auditLog) throw new Error(`审计记录不存在: ${reviewId}`);

      const application = await prisma.serviceApplication.findFirst({
        where: { applicationId: auditLog.targetId },
      });
      if (!application) throw new Error(`申请记录不存在: ${auditLog.targetId}`);
      if (application.status !== 'rejected') throw new Error('只能重新开启已拒绝的申请');

      const hoursDiff = (Date.now() - new Date(application.updatedAt).getTime()) / (1000 * 60 * 60);
      const maxReopenHours = 24;
      if (hoursDiff > maxReopenHours) {
        throw new Error(`申请已拒绝超过${maxReopenHours}小时，无法重新开启`);
      }

      const actionDetails = auditLog.actionDetails || {};
      const operator = auditLog.operator || {};

      await prisma.serviceApplication.update({
        where: { applicationId: application.applicationId },
        data: {
          status: 'pending',
          reviewNotes: `重新开启 - ${actionDetails.reviewNote || ''}`,
          updatedAt: new Date(),
        },
      });

      const reopenAuditId = await IDGenerator.generateAuditId(reviewer.id);

      await prisma.auditLog.create({
        data: {
          auditId: reopenAuditId,
          targetType: 'ServiceApplication',
          targetId: application.applicationId,
          action: 'application_reopen',
          actionDetails: {
            applicationType: application.applicationType,
            reviewResult: 'reopened',
            reviewNote: `申请已重新开启，原审核人: ${operator.name || ''}`,
          },
          modifiedId: auditLog.modifiedId || null,
          changes: Array.isArray(auditLog.changes) ? auditLog.changes : [],
          operator: { id: reviewer.id, name: reviewer.name, role: reviewer.role },
          submitter: application.submittedBy || {},
        },
      });

      return {
        success: true,
        applicationId: application.applicationId,
        newStatus: 'pending',
        auditLogId: reopenAuditId,
        message: '申请已重新开启',
      };
    } catch (error) {
      console.error('重新开启申请失败:', error);
      throw error;
    }
  }

  /**
   * 撤回审核结果
   */
  static async withdrawReview(reviewId, reviewer) {
    try {
      const auditLog = await this.resolveReviewAuditLog(reviewId);
      if (!auditLog) throw new Error(`审计记录不存在: ${reviewId}`);

      const operator = auditLog.operator || {};
      if (operator.id !== reviewer.id) throw new Error('只能撤回自己创建的审核结果');

      const minutesDiff = (Date.now() - new Date(auditLog.timestamp).getTime()) / (1000 * 60);
      const maxWithdrawMinutes = 30;
      if (minutesDiff > maxWithdrawMinutes) {
        throw new Error(`审核已超过${maxWithdrawMinutes}分钟，无法撤回`);
      }

      const application = await prisma.serviceApplication.findFirst({
        where: { applicationId: auditLog.targetId },
      });
      if (!application) throw new Error(`申请记录不存在: ${auditLog.targetId}`);
      if (!['approved', 'rejected'].includes(application.status)) {
        throw new Error('只能撤回已审核的申请');
      }

      return await prisma.$transaction(async (tx) => {
        const originalStatus = application.status;

        await tx.serviceApplication.update({
          where: { applicationId: application.applicationId },
          data: {
            status: 'pending',
            reviewNotes: `审核结果已撤回，原状态: ${originalStatus}`,
            updatedAt: new Date(),
          },
        });

        if (originalStatus === 'approved' && auditLog.modifiedId) {
          await this.revertServiceRecordChanges(auditLog, tx);
        }

        const withdrawAuditId = await IDGenerator.generateAuditId(reviewer.id);
        const actionDetails = auditLog.actionDetails || {};

        await tx.auditLog.create({
          data: {
            auditId: withdrawAuditId,
            targetType: 'ServiceApplication',
            targetId: application.applicationId,
            action: 'review_withdraw',
            actionDetails: {
              applicationType: application.applicationType,
              reviewResult: 'withdrawn',
              reviewNote: `审核结果已撤回，原结果: ${actionDetails.reviewResult || ''}`,
            },
            modifiedId: auditLog.modifiedId || null,
            changes: Array.isArray(auditLog.changes) ? auditLog.changes : [],
            operator: { id: reviewer.id, name: reviewer.name, role: reviewer.role },
            submitter: application.submittedBy || {},
          },
        });

        return {
          success: true,
          applicationId: application.applicationId,
          newStatus: 'pending',
          auditLogId: withdrawAuditId,
          originalResult: actionDetails.reviewResult,
          message: '审核结果已成功撤回',
        };
      });
    } catch (error) {
      console.error('撤回审核结果失败:', error);
      throw error;
    }
  }

  /**
   * 撤销对服务记录的更改
   * @private
   */
  static async revertServiceRecordChanges(auditLog, tx = prisma) {
    const actionDetails = auditLog.actionDetails || {};
    const { applicationType } = actionDetails;
    const { modifiedId, changes } = auditLog;

    if (!modifiedId) return;

    switch (applicationType) {
      case 'create': {
        // 创建被撤回：删除创建的记录
        await tx.nonProjectService.deleteMany({ where: { serviceId: modifiedId } });
        break;
      }
      case 'update': {
        // 更新被撤回：恢复原始值，移除最后一条审核历史
        const serviceRecord = await tx.nonProjectService.findFirst({
          where: { serviceId: modifiedId },
        });
        if (serviceRecord) {
          const changeList = Array.isArray(changes) ? changes : [];
          const revertData = {};
          for (const change of changeList) {
            if (change.field === 'serviceType') {
              revertData[change.field] = SERVICE_TYPE_TO_PG[change.from] || change.from;
            } else if (change.field === 'serviceDate') {
              revertData[change.field] = new Date(change.from);
            } else {
              revertData[change.field] = change.from;
            }
          }
          const currentHistory = Array.isArray(serviceRecord.auditHistory) ? serviceRecord.auditHistory : [];
          const newHistory = currentHistory.slice(0, -1);
          await tx.nonProjectService.update({
            where: { serviceId: modifiedId },
            data: { ...revertData, auditHistory: newHistory },
          });
        }
        break;
      }
      case 'delete': {
        // 删除被撤回：恢复记录
        await tx.nonProjectService.updateMany({
          where: { serviceId: modifiedId },
          data: { isActive: true, updatedAt: new Date() },
        });
        break;
      }
    }

    // serviceId format: NPS-PG-0001-001 → extract PG-0001
    const parts = modifiedId.split('-');
    const volunteerId = parts.length >= 3 ? `${parts[1]}-${parts[2]}` : null;
    if (volunteerId) {
      await this.updateVolunteerStatistics(volunteerId, tx);
    }
  }
}

export default ReviewService;
