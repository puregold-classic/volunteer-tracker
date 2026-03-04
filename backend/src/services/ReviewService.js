// src/services/ReviewService.js
import ServiceApplication from '../models/ServiceApplication.js';
import NonProjectService from '../models/NonProjectService.js';
import AuditLog from '../models/AuditLog.js';
import Volunteer from '../models/Volunteer.js';
import { IDGenerator } from '../utils/idUtils.js';
import TransactionUtils from '../utils/transactionUtils.js';

/**
 * 审核业务逻辑服务
 * 处理申请审核的核心业务逻辑
 */
class ReviewService {
  static isTransactionUnsupported(error) {
    const message = error?.message || '';
    return message.includes('Transaction numbers are only allowed on a replica set member or mongos');
  }
  /**
   * 解析审核标识：支持 auditId 或 applicationId
   * @private
   */
  static async resolveReviewAuditLog(reviewIdOrApplicationId) {
    // 先按审计ID查找
    let auditLog = await AuditLog.findOne({ auditId: reviewIdOrApplicationId });
    if (auditLog) return auditLog;

    // 兼容按申请ID传入：取最近一次 application_review 记录
    auditLog = await AuditLog.findOne({
      targetId: reviewIdOrApplicationId,
      action: 'application_review'
    }).sort({ timestamp: -1 });

    return auditLog;
  }
  
  /**
   * 审核申请（通用方法）
   * @param {string} applicationId - 申请ID
   * @param {Object} reviewData - 审核数据 { result, notes }
   * @param {Object} reviewer - 审核人信息 { id, name, role }
   * @returns {Promise<Object>} - 审核结果
   */
  static async reviewApplication(applicationId, reviewData, reviewer) {
    try {
      console.log('开始审核申请:', {
        applicationId,
        result: reviewData.result,
        reviewer: reviewer.id
      });
      
      // 步骤1: 查找申请并验证
      const application = await this.validateApplicationForReview(applicationId);
      
      // 步骤2: 根据申请类型执行不同的审核逻辑
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
      
      console.log('审核完成:', {
        applicationId,
        result: reviewData.result,
        modifiedId: reviewResult.modifiedId
      });
      
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
    const application = await ServiceApplication.findOne({ 
      applicationId,
      status: 'pending'
    });
    
    if (!application) {
      throw new Error(`申请不存在或已被处理: ${applicationId}`);
    }
    
    // 检查是否已过期（如果有过期时间）
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
  // 开发环境：不使用事务
  if (process.env.NODE_ENV === 'development') {
    return await this.reviewCreateApplicationWithoutTransaction(application, reviewData, reviewer);
  }
  
  // 生产环境：使用事务
  return await TransactionUtils.executeTransaction(async (session) => {
    return await this.executeReviewCreateWithTransaction(application, reviewData, reviewer, session);
  });
}

/**
 * 无事务版本的审核创建申请（用于开发环境）
 * @private
 */
static async reviewCreateApplicationWithoutTransaction(application, reviewData, reviewer) {
  console.log('🔧 使用无事务版本（开发环境）');
  
  let modifiedId = null;
  let serviceRecord = null;
  
  // 如果审核通过
  if (reviewData.result === 'approved') {
    // 生成服务记录ID（使用本地生成方法）
    const serviceId = await IDGenerator.generateServiceId(application.volunteerId);
    
    // 从changes中提取数据
    const changesData = this.extractDataFromChanges(application.changes);
    
    // 创建服务记录
    serviceRecord = new NonProjectService({
      serviceId,
      volunteerId: application.volunteerId,
      volunteerName: application.volunteerName,
      serviceDate: changesData.serviceDate,
      serviceType: changesData.serviceType,
      duration: changesData.duration,
      description: changesData.description,
      // 索引字段
      indexedServiceType: changesData.serviceType,
      indexedServiceDate: new Date(changesData.serviceDate),
      indexedVolunteerId: application.volunteerId,
      auditHistory: [{
        // 使用本地auditId生成
        auditId: await IDGenerator.generateAuditId(reviewer.id),
        auditTime: new Date(),
        auditResult: 'approved',
        reviewerId: reviewer.id,
        reviewerName: reviewer.name,
        auditNote: reviewData.notes || '审核通过',
        applicationId: application.applicationId
      }],
      isActive: true
    });
    
    await serviceRecord.save(); // 无session参数
    modifiedId = serviceId;
    
    // 更新志愿者统计
    await this.updateVolunteerStatistics(application.volunteerId); // 无session参数
  }
  
  // 更新申请状态
  application.status = reviewData.result;
  application.reviewNotes = reviewData.notes || '';
  application.updatedAt = new Date();
  application.indexedStatus = reviewData.result;
  await application.save(); // 无session参数
  
  // 创建审计日志（无事务版本）
  await this.createAuditLogWithoutTransaction({
    application,
    reviewData,
    reviewer,
    submitter: application.submittedBy,
    modifiedId,
    changes: application.changes
  });
  
  return {
    success: true,
    applicationId: application.applicationId,
    result: reviewData.result,
    modifiedId,
    serviceRecord: serviceRecord ? this.sanitizeServiceRecord(serviceRecord) : null
  };
}

  /**
   * 有事务版本的审核创建申请（用于生产环境）
   * @private
   */
  static async executeReviewCreateWithTransaction(application, reviewData, reviewer, session) {
    console.log('🚀 使用事务版本（生产环境）');
    
    let modifiedId = null;
    let serviceRecord = null;
    
    // 如果审核通过
    if (reviewData.result === 'approved') {
      // 生成服务记录ID
      const serviceId = await IDGenerator.generateServiceId(application.volunteerId);
      
      // 从changes中提取数据
      const changesData = this.extractDataFromChanges(application.changes);
      
      // 创建服务记录
      serviceRecord = new NonProjectService({
        serviceId,
        volunteerId: application.volunteerId,
        volunteerName: application.volunteerName,
        serviceDate: changesData.serviceDate,
        serviceType: changesData.serviceType,
        duration: changesData.duration,
        description: changesData.description,
        indexedServiceType: changesData.serviceType,
        indexedServiceDate: new Date(changesData.serviceDate),
        indexedVolunteerId: application.volunteerId,
        auditHistory: [{
          auditId: await IDGenerator.generateAuditId(reviewer.id),
          auditTime: new Date(),
          auditResult: 'approved',
          reviewerId: reviewer.id,
          reviewerName: reviewer.name,
          auditNote: reviewData.notes || '审核通过',
          applicationId: application.applicationId
        }],
        isActive: true
      });
      
      await serviceRecord.save({ session });
      modifiedId = serviceId;
      
      // 更新志愿者统计
      await this.updateVolunteerStatistics(application.volunteerId, session);
    }
    
    // 更新申请状态
    application.status = reviewData.result;
    application.reviewNotes = reviewData.notes || '';
    application.updatedAt = new Date();
    application.indexedStatus = reviewData.result;
    await application.save({ session });
    
    // 创建审计日志
    await this.createAuditLog({
      application,
      reviewData,
      reviewer,
      submitter: application.submittedBy,
      modifiedId,
      changes: application.changes,
      session
    });
    
    return {
      success: true,
      applicationId: application.applicationId,
      result: reviewData.result,
      modifiedId,
      serviceRecord: serviceRecord ? this.sanitizeServiceRecord(serviceRecord) : null
    };
  }

  /**
   * 创建审计日志（无事务版本）
   * @private
   */
  static async createAuditLogWithoutTransaction(params) {
    const {
      application,
      reviewData,
      reviewer,
      submitter,
      modifiedId,
      changes
    } = params;
    
    const auditId = await IDGenerator.generateAuditId(reviewer.id);
    
    const auditLog = new AuditLog({
      auditId,
      targetType: 'ServiceApplication',
      targetId: application.applicationId,
      action: 'application_review',
      actionDetails: {
        applicationType: application.applicationType,
        reviewResult: reviewData.result,
        reviewNote: reviewData.notes || (reviewData.result === 'approved' ? '审核通过' : '审核拒绝')
      },
      modifiedId,
      changes,
      operator: {
        id: reviewer.id,
        name: reviewer.name,
        role: reviewer.role
      },
      submitter: {
        id: submitter.id,
        name: submitter.name,
        role: submitter.role
      },
      timestamp: new Date(),
      // 添加索引字段 ← 新增这两行
      indexedTargetId: application.applicationId,
      indexedOperatorId: reviewer.id
    });
    
    await auditLog.save();
    console.log(`审计日志已创建（无事务）: ${auditId}`);
  }
  
  /**
   * 审核更新申请
   * @private
   */
  static async reviewUpdateApplication(application, reviewData, reviewer) {
    try {
      return await TransactionUtils.executeTransaction(async (session) => {
      // 查找目标记录
      const targetRecord = await NonProjectService.findOne({
        serviceId: application.targetId,
        isActive: true
      }).session(session);
      
      if (!targetRecord) {
        throw new Error(`目标服务记录不存在: ${application.targetId}`);
      }
      
      let modifiedId = application.targetId;
      
      // 如果审核通过
      if (reviewData.result === 'approved') {
        // 保存旧值用于审计
        const oldValues = {};
        const changesData = this.extractDataFromChanges(application.changes);
        
        // 应用变更
        for (const change of application.changes) {
          oldValues[change.field] = targetRecord[change.field];
          targetRecord[change.field] = change.to;
        }
        
        // 添加审核历史
        targetRecord.auditHistory.push({
          auditId: await IDGenerator.generateAuditId(reviewer.id),
          auditTime: new Date(),
          auditResult: 'approved',
          reviewerId: reviewer.id,
          reviewerName: reviewer.name,
          auditNote: reviewData.notes || '审核通过',
          applicationId: application.applicationId,
          oldValues // 记录变更前的值
        });
        
        targetRecord.updatedAt = new Date();
        await targetRecord.save({ session });
        
        // 更新志愿者统计（如果时长变化）
        if (changesData.duration !== oldValues.duration) {
          await this.updateVolunteerStatistics(application.volunteerId, session);
        }
      }
      
      // 更新申请状态
      application.status = reviewData.result;
      application.reviewNotes = reviewData.notes || '';
      application.updatedAt = new Date();
      application.indexedStatus = reviewData.result;
      await application.save({ session });
      
      // 创建审计日志（无论通过还是拒绝，modifiedId都是targetId）
      await this.createAuditLog({
        application,
        reviewData,
        reviewer,
        submitter: application.submittedBy,
        modifiedId,
        changes: application.changes,
        session
      });
      
      return {
        success: true,
        applicationId: application.applicationId,
        result: reviewData.result,
        modifiedId,
        targetRecord: reviewData.result === 'approved' ? this.sanitizeServiceRecord(targetRecord) : null
      };
      });
    } catch (error) {
      if (!this.isTransactionUnsupported(error)) {
        throw error;
      }
      console.warn('事务不可用，降级为无事务审核(update):', error.message);
      return await this.reviewUpdateApplicationWithoutTransaction(application, reviewData, reviewer);
    }
  }
  
  /**
   * 审核删除申请
   * @private
   */
  static async reviewDeleteApplication(application, reviewData, reviewer) {
    try {
      return await TransactionUtils.executeTransaction(async (session) => {
      // 查找目标记录
      const targetRecord = await NonProjectService.findOne({
        serviceId: application.targetId,
        isActive: true
      }).session(session);
      
      if (!targetRecord) {
        throw new Error(`目标服务记录不存在: ${application.targetId}`);
      }
      
      let modifiedId = application.targetId;
      
      // 如果审核通过
      if (reviewData.result === 'approved') {
        // 软删除：将isActive设为false
        targetRecord.isActive = false;
        targetRecord.updatedAt = new Date();
        
        // 删除后仅保留本次删除审核历史，清理旧历史
        targetRecord.auditHistory = [{
          auditId: await IDGenerator.generateAuditId(reviewer.id),
          auditTime: new Date(),
          auditResult: 'approved',
          reviewerId: reviewer.id,
          reviewerName: reviewer.name,
          auditNote: reviewData.notes || '审核通过，记录已删除',
          applicationId: application.applicationId
        }];
        
        await targetRecord.save({ session });
        
        // 更新志愿者统计（减去被删除的记录）
        await this.updateVolunteerStatistics(application.volunteerId, session);
      }
      
      // 更新申请状态
      application.status = reviewData.result;
      application.reviewNotes = reviewData.notes || '';
      application.updatedAt = new Date();
      application.indexedStatus = reviewData.result;
      await application.save({ session });
      
      // 创建审计日志
      await this.createAuditLog({
        application,
        reviewData,
        reviewer,
        submitter: application.submittedBy,
        modifiedId,
        changes: application.changes,
        session
      });
      
      return {
        success: true,
        applicationId: application.applicationId,
        result: reviewData.result,
        modifiedId,
        targetRecord: reviewData.result === 'approved' ? this.sanitizeServiceRecord(targetRecord) : null
      };
      });
    } catch (error) {
      if (!this.isTransactionUnsupported(error)) {
        throw error;
      }
      console.warn('事务不可用，降级为无事务审核(delete):', error.message);
      return await this.reviewDeleteApplicationWithoutTransaction(application, reviewData, reviewer);
    }
  }

  /**
   * 无事务版本的审核更新申请
   * @private
   */
  static async reviewUpdateApplicationWithoutTransaction(application, reviewData, reviewer) {
    const targetRecord = await NonProjectService.findOne({
      serviceId: application.targetId,
      isActive: true
    });

    if (!targetRecord) {
      throw new Error(`目标服务记录不存在: ${application.targetId}`);
    }

    let modifiedId = application.targetId;

    if (reviewData.result === 'approved') {
      const oldValues = {};
      const changesData = this.extractDataFromChanges(application.changes);

      for (const change of application.changes) {
        oldValues[change.field] = targetRecord[change.field];
        targetRecord[change.field] = change.to;
      }

      targetRecord.auditHistory.push({
        auditId: await IDGenerator.generateAuditId(reviewer.id),
        auditTime: new Date(),
        auditResult: 'approved',
        reviewerId: reviewer.id,
        reviewerName: reviewer.name,
        auditNote: reviewData.notes || '审核通过',
        applicationId: application.applicationId,
        oldValues
      });

      targetRecord.updatedAt = new Date();
      await targetRecord.save();

      if (changesData.duration !== oldValues.duration) {
        await this.updateVolunteerStatistics(application.volunteerId);
      }
    }

    application.status = reviewData.result;
    application.reviewNotes = reviewData.notes || '';
    application.updatedAt = new Date();
    application.indexedStatus = reviewData.result;
    await application.save();

    await this.createAuditLogWithoutTransaction({
      application,
      reviewData,
      reviewer,
      submitter: application.submittedBy,
      modifiedId,
      changes: application.changes
    });

    return {
      success: true,
      applicationId: application.applicationId,
      result: reviewData.result,
      modifiedId,
      targetRecord: reviewData.result === 'approved' ? this.sanitizeServiceRecord(targetRecord) : null
    };
  }

  /**
   * 无事务版本的审核删除申请
   * @private
   */
  static async reviewDeleteApplicationWithoutTransaction(application, reviewData, reviewer) {
    const targetRecord = await NonProjectService.findOne({
      serviceId: application.targetId,
      isActive: true
    });

    if (!targetRecord) {
      throw new Error(`目标服务记录不存在: ${application.targetId}`);
    }

    let modifiedId = application.targetId;

    if (reviewData.result === 'approved') {
      targetRecord.isActive = false;
      targetRecord.updatedAt = new Date();

      // 删除后仅保留本次删除审核历史，清理旧历史
      targetRecord.auditHistory = [{
        auditId: await IDGenerator.generateAuditId(reviewer.id),
        auditTime: new Date(),
        auditResult: 'approved',
        reviewerId: reviewer.id,
        reviewerName: reviewer.name,
        auditNote: reviewData.notes || '审核通过，记录已删除',
        applicationId: application.applicationId
      }];

      await targetRecord.save();
      await this.updateVolunteerStatistics(application.volunteerId);
    }

    application.status = reviewData.result;
    application.reviewNotes = reviewData.notes || '';
    application.updatedAt = new Date();
    application.indexedStatus = reviewData.result;
    await application.save();

    await this.createAuditLogWithoutTransaction({
      application,
      reviewData,
      reviewer,
      submitter: application.submittedBy,
      modifiedId,
      changes: application.changes
    });

    return {
      success: true,
      applicationId: application.applicationId,
      result: reviewData.result,
      modifiedId,
      targetRecord: reviewData.result === 'approved' ? this.sanitizeServiceRecord(targetRecord) : null
    };
  }
  
  /**
   * 批量审核申请
   * @param {Array} reviewRequests - 审核请求数组
   * @param {Object} reviewer - 审核人信息
   * @returns {Promise<Object>} - 批量审核结果
   */
  static async batchReviewApplications(reviewRequests, reviewer) {
    console.log('开始批量审核:', {
      count: reviewRequests.length,
      reviewer: reviewer.id
    });
    
    const results = [];
    
    for (const request of reviewRequests) {
      try {
        const result = await this.reviewApplication(
          request.applicationId,
          request.reviewData,
          reviewer
        );
        
        results.push({
          success: true,
          applicationId: request.applicationId,
          ...result
        });
        
      } catch (error) {
        results.push({
          success: false,
          applicationId: request.applicationId,
          error: error.message
        });
      }
    }
    
    // 统计结果
    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log('批量审核完成:', {
      total: reviewRequests.length,
      succeeded,
      failed
    });
    
    return {
      results,
      summary: {
        total: reviewRequests.length,
        succeeded,
        failed,
        successRate: (succeeded / reviewRequests.length * 100).toFixed(2) + '%'
      }
    };
  }
  
  // ========== 辅助方法 ==========
  
  /**
   * 从changes数组中提取数据
   * @private
   */
  static extractDataFromChanges(changes) {
    const result = {};
    
    for (const change of changes) {
      result[change.field] = change.to;
    }
    
    return result;
  }
  
  /**
   * 更新志愿者统计
   * @private
   */
  static async updateVolunteerStatistics(volunteerId, session = null) {
    try {
      const volunteer = await Volunteer.findOne({ id: volunteerId }).session(session);
      
      if (!volunteer) {
        console.warn(`志愿者不存在，无法更新统计: ${volunteerId}`);
        return;
      }
      
      // 重新计算统计信息
      const stats = await NonProjectService.aggregate([
        {
          $match: {
            volunteerId: volunteerId,
            isActive: true
          }
        },
        {
          $group: {
            _id: null,
            totalHours: { $sum: '$duration' },
            totalCount: { $sum: 1 }
          }
        }
      ]);
      
      if (stats.length > 0) {
        volunteer.nonProjectHours = stats[0].totalHours;
        volunteer.nonProjectCount = stats[0].totalCount;
        
        // 根据时长更新活跃度
        if (volunteer.nonProjectHours >= 100) {
          volunteer.activityLevel = '高';
        } else if (volunteer.nonProjectHours >= 30) {
          volunteer.activityLevel = '中';
        } else {
          volunteer.activityLevel = '低';
        }
      } else {
        volunteer.nonProjectHours = 0;
        volunteer.nonProjectCount = 0;
        volunteer.activityLevel = '低';
      }
      
      await volunteer.save({ session });
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
  static async createAuditLog(params) {
    const {
      application,
      reviewData,
      reviewer,
      submitter,
      modifiedId,
      changes,
      session
    } = params;
    
    const auditId = await IDGenerator.generateAuditId(reviewer.id);
    
    const auditLog = new AuditLog({
      auditId,
      targetType: 'ServiceApplication',
      targetId: application.applicationId,
      action: 'application_review',
      actionDetails: {
        applicationType: application.applicationType,
        reviewResult: reviewData.result,
        reviewNote: reviewData.notes || (reviewData.result === 'approved' ? '审核通过' : '审核拒绝')
      },
      modifiedId,
      changes,
      operator: {
        id: reviewer.id,
        name: reviewer.name,
        role: reviewer.role
      },
      submitter: {
        id: submitter.id,
        name: submitter.name,
        role: submitter.role
      },
      timestamp: new Date(),
      indexedTargetId: application.applicationId,
      indexedOperatorId: reviewer.id
    });
    
    await auditLog.save({ session });
    console.log(`审计日志已创建: ${auditId}`);
  }
  
  /**
   * 清理服务记录对象（移除内部字段）
   * @private
   */
  static sanitizeServiceRecord(record) {
    if (!record) return null;
    
    const sanitized = record.toObject ? record.toObject() : { ...record };
    
    // 移除内部字段
    delete sanitized.__v;
    delete sanitized.indexedVolunteerId;
    delete sanitized.indexedServiceDate;
    delete sanitized.indexedServiceType;
    delete sanitized.indexedIsActive;
    
    return sanitized;
  }
  
  /**
   * 重新开启已拒绝的申请
   * @param {string} reviewId - 审计ID
   * @param {Object} reviewer - 审核人信息
   * @returns {Promise<Object>} - 重开结果
   */
  static async reopenReview(reviewId, reviewer) {
    try {
      // 查找审计记录
      const auditLog = await this.resolveReviewAuditLog(reviewId);
      
      if (!auditLog) {
        throw new Error(`审计记录不存在: ${reviewId}`);
      }
      
      // 查找对应的申请
      const application = await ServiceApplication.findOne({
        applicationId: auditLog.targetId
      });
      
      if (!application) {
        throw new Error(`申请记录不存在: ${auditLog.targetId}`);
      }
      
      // 只有拒绝的申请可以重开
      if (application.status !== 'rejected') {
        throw new Error('只能重新开启已拒绝的申请');
      }
      
      // 检查拒绝时间（是否在允许的时间窗口内）
      const rejectTime = new Date(application.updatedAt);
      const now = new Date();
      const hoursDiff = (now - rejectTime) / (1000 * 60 * 60);
      
      // 假设允许24小时内重开（可配置）
      const maxReopenHours = 24;
      if (hoursDiff > maxReopenHours) {
        throw new Error(`申请已拒绝超过${maxReopenHours}小时，无法重新开启`);
      }
      
      // 重新开启申请
      application.status = 'pending';
      application.reviewNotes = `重新开启 - ${auditLog.actionDetails.reviewNote}`;
      application.updatedAt = new Date();
      application.indexedStatus = 'pending';
      
      await application.save();
      
      // 创建重开的审计日志
      const reopenAuditId = await IDGenerator.generateAuditId(reviewer.id);
      
      const reopenAuditLog = new AuditLog({
        auditId: reopenAuditId,
        targetType: 'ServiceApplication',
        targetId: application.applicationId,
        action: 'application_reopen',
        actionDetails: {
          applicationType: application.applicationType,
          reviewResult: 'reopened',
          reviewNote: `申请已重新开启，原审核人: ${auditLog.operator.name}`
        },
        modifiedId: auditLog.modifiedId,
        changes: auditLog.changes,
        operator: {
          id: reviewer.id,
          name: reviewer.name,
          role: reviewer.role
        },
        submitter: application.submittedBy,
        timestamp: new Date()
      });
      
      await reopenAuditLog.save();
      
      return {
        success: true,
        applicationId: application.applicationId,
        newStatus: 'pending',
        auditLogId: reopenAuditId,
        message: '申请已重新开启'
      };
      
    } catch (error) {
      console.error('重新开启申请失败:', error);
      throw error;
    }
  }
  
  /**
   * 撤回审核结果
   * @param {string} reviewId - 审计ID
   * @param {Object} reviewer - 审核人信息
   * @returns {Promise<Object>} - 撤回结果
   */
  static async withdrawReview(reviewId, reviewer) {
    try {
      // 查找审计记录
      const auditLog = await this.resolveReviewAuditLog(reviewId);
      
      if (!auditLog) {
        throw new Error(`审计记录不存在: ${reviewId}`);
      }
      
      // 检查审核人是否匹配
      if (auditLog.operator.id !== reviewer.id) {
        throw new Error('只能撤回自己创建的审核结果');
      }
      
      // 检查审核时间（是否在允许撤回的时间窗口内）
      const reviewTime = new Date(auditLog.timestamp);
      const now = new Date();
      const minutesDiff = (now - reviewTime) / (1000 * 60);
      
      // 假设允许30分钟内撤回（可配置）
      const maxWithdrawMinutes = 30;
      if (minutesDiff > maxWithdrawMinutes) {
        throw new Error(`审核已超过${maxWithdrawMinutes}分钟，无法撤回`);
      }
      
      // 查找对应的申请
      const application = await ServiceApplication.findOne({
        applicationId: auditLog.targetId
      });
      
      if (!application) {
        throw new Error(`申请记录不存在: ${auditLog.targetId}`);
      }
      
      // 只有已审核的申请可以撤回
      if (!['approved', 'rejected'].includes(application.status)) {
        throw new Error('只能撤回已审核的申请');
      }
      
      // 使用事务撤回
      return await TransactionUtils.executeTransaction(async (session) => {
        // 恢复申请状态
        const originalStatus = application.status;
        application.status = 'pending';
        application.reviewNotes = `审核结果已撤回，原状态: ${originalStatus}`;
        application.updatedAt = new Date();
        application.indexedStatus = 'pending';
        await application.save({ session });
        
        // 如果审核通过，需要撤销对NonProjectService的操作
        if (originalStatus === 'approved' && auditLog.modifiedId) {
          await this.revertServiceRecordChanges(auditLog, session);
        }
        
        // 创建撤回的审计日志
        const withdrawAuditId = await IDGenerator.generateAuditId(reviewer.id);
        
        const withdrawAuditLog = new AuditLog({
          auditId: withdrawAuditId,
          targetType: 'ServiceApplication',
          targetId: application.applicationId,
          action: 'review_withdraw',
          actionDetails: {
            applicationType: application.applicationType,
            reviewResult: 'withdrawn',
            reviewNote: `审核结果已撤回，原结果: ${auditLog.actionDetails.reviewResult}`
          },
          modifiedId: auditLog.modifiedId,
          changes: auditLog.changes,
          operator: {
            id: reviewer.id,
            name: reviewer.name,
            role: reviewer.role
          },
          submitter: application.submittedBy,
          timestamp: new Date()
        });
        
        await withdrawAuditLog.save({ session });
        
        return {
          success: true,
          applicationId: application.applicationId,
          newStatus: 'pending',
          auditLogId: withdrawAuditId,
          originalResult: auditLog.actionDetails.reviewResult,
          message: '审核结果已成功撤回'
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
  static async revertServiceRecordChanges(auditLog, session) {
    const { applicationType } = auditLog.actionDetails;
    const { modifiedId, changes } = auditLog;
    
    if (!modifiedId) return;
    
    switch (applicationType) {
      case 'create': {
        // 创建被撤回：删除创建的记录
        await NonProjectService.deleteOne({ 
          serviceId: modifiedId 
        }).session(session);
        break;
      }
      case 'update': {
        // 更新被撤回：恢复原始值
        const serviceRecord = await NonProjectService.findOne({
          serviceId: modifiedId
        }).session(session);
        
        if (serviceRecord) {
          for (const change of changes) {
            serviceRecord[change.field] = change.from;
          }
          
          // 移除最后一条审核历史（即被撤回的审核）
          if (serviceRecord.auditHistory.length > 0) {
            serviceRecord.auditHistory.pop();
          }
          
          await serviceRecord.save({ session });
        }
        break;
      }
      case 'delete': {
        // 删除被撤回：恢复记录
        await NonProjectService.updateOne(
          { serviceId: modifiedId },
          { 
            $set: { 
              isActive: true,
              updatedAt: new Date()
            }
          }
        ).session(session);
        break;
      }
    }
    
    // 更新志愿者统计
    const volunteerId = modifiedId.split('-')[1]; // 从NPS-PG-0001-001中提取PG-0001
    await this.updateVolunteerStatistics(volunteerId, session);
  }
}

export default ReviewService;
