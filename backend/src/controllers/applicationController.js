// src/controllers/applicationController.js
// Phase 5: Switched from Mongoose to Prisma. Shadow writes removed.
// indexed* mirror fields are not present in PG schema and are omitted.

import prisma from '../utils/prismaClient.js';
import ValidationUtils from '../utils/validationUtils.js';
import { IDGenerator } from '../utils/idUtils.js';
import QueryUtils from '../utils/queryUtils.js';
import { serializeApplication } from '../utils/pgSerializer.js';

class ApplicationController {
  static normalizeChangeValue(field, value) {
    if (value === null || value === undefined) return value;
    if (field === 'serviceDate') return new Date(value).toISOString().split('T')[0];
    if (typeof value === 'string') return value.trim();
    return value;
  }

  static normalizeChanges(changes = []) {
    return [...changes]
      .map(c => ({
        field: c.field,
        from: ApplicationController.normalizeChangeValue(c.field, c.from),
        to: ApplicationController.normalizeChangeValue(c.field, c.to),
      }))
      .sort((a, b) => a.field.localeCompare(b.field));
  }

  static buildCreateProjectSignature(changes = []) {
    const normalized = ApplicationController.normalizeChanges(changes);
    const fields = ['serviceDate', 'serviceType', 'duration', 'description'];
    const map = new Map(normalized.map(item => [item.field, item.to]));
    if (!fields.every(f => map.has(f))) return null;
    return JSON.stringify({
      serviceDate: map.get('serviceDate'),
      serviceType: map.get('serviceType'),
      duration: map.get('duration'),
      description: map.get('description'),
    });
  }

  static async findPendingProjectConflict(applicationData, validatedChanges) {
    if (applicationData.targetId) {
      const conflict = await prisma.serviceApplication.findFirst({
        where: { status: 'pending', targetId: applicationData.targetId },
        select: { applicationId: true, applicationType: true, status: true, targetId: true, createdAt: true },
      });
      return conflict || null;
    }

    const incomingSignature = ApplicationController.buildCreateProjectSignature(validatedChanges);
    if (!incomingSignature) return null;

    const candidates = await prisma.serviceApplication.findMany({
      where: {
        status: 'pending',
        volunteerId: applicationData.volunteerId,
        applicationType: 'create',
        targetId: null,
      },
      select: { applicationId: true, applicationType: true, status: true, targetId: true, createdAt: true, changes: true },
    });

    return candidates.find(c => {
      const sig = ApplicationController.buildCreateProjectSignature(
        Array.isArray(c.changes) ? c.changes : []
      );
      return sig === incomingSignature;
    }) || null;
  }

  // POST /api/v1/applications
  static async submitApplication(req, res) {
    try {
      const applicationData = req.body;
      const { submittedBy } = applicationData;

      console.log('收到申请提交请求:', {
        type: applicationData.applicationType,
        volunteer: applicationData.volunteerId,
        submittedBy: submittedBy.id,
      });

      const validationResult = await ValidationUtils.validateApplicationData(applicationData);
      if (!validationResult.isValid) {
        return res.status(400).json({
          success: false,
          error: validationResult.error,
          timestamp: new Date().toISOString(),
        });
      }

      const conflict = await ApplicationController.findPendingProjectConflict(
        applicationData, validationResult.validatedChanges
      );
      if (conflict) {
        return res.status(409).json({
          success: false,
          error: `该项目已在审核队列中（${conflict.applicationId} / ${conflict.applicationType}），请等待处理后再提交`,
          code: 'PENDING_PROJECT_CONFLICT',
          timestamp: new Date().toISOString(),
        });
      }

      const applicationId = await IDGenerator.generateApplicationId(submittedBy.id);

      const savedApplication = await prisma.serviceApplication.create({
        data: {
          applicationId,
          applicationType: applicationData.applicationType,
          targetType: 'NonProjectService',
          volunteerId: applicationData.volunteerId,
          volunteerName: applicationData.volunteerName,
          changes: validationResult.validatedChanges,
          targetId: applicationData.targetId || null,
          submittedBy: {
            id: submittedBy.id,
            name: submittedBy.name,
            role: submittedBy.role,
            timestamp: new Date().toISOString(),
          },
          status: 'pending',
          reviewNotes: '',
          expiresAt: null,
        },
      });

      console.log('申请提交成功:', {
        applicationId: savedApplication.applicationId,
        volunteerId: savedApplication.volunteerId,
        type: savedApplication.applicationType,
      });

      return res.status(201).json({
        success: true,
        message: '申请提交成功，等待审核',
        data: {
          applicationId: savedApplication.applicationId,
          status: savedApplication.status,
          submittedAt: savedApplication.createdAt,
          volunteerId: savedApplication.volunteerId,
          volunteerName: savedApplication.volunteerName,
          applicationType: savedApplication.applicationType,
          expiresAt: savedApplication.expiresAt,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error.code === 'P2002') {
        return res.status(409).json({ success: false, error: '申请ID冲突，请重试', timestamp: new Date().toISOString() });
      }
      console.error('申请提交失败:', error);
      return res.status(500).json({
        success: false,
        error: '服务器内部错误',
        detail: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // POST /api/v1/applications/validate
  static async validateApplication(req, res) {
    try {
      const applicationData = req.body;
      const validationResult = await ValidationUtils.validateApplicationData(applicationData);

      if (!validationResult.isValid) {
        return res.status(400).json({
          success: false, isValid: false,
          error: validationResult.error,
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(200).json({
        success: true, isValid: true,
        message: validationResult.message,
        data: {
          volunteerId: applicationData.volunteerId,
          volunteerName: applicationData.volunteerName,
          applicationType: applicationData.applicationType,
          changesCount: applicationData.changes?.length || 0,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return res.status(500).json({ success: false, isValid: false, error: '预验证过程中发生错误', timestamp: new Date().toISOString() });
    }
  }

  // GET /api/v1/applications/my
  static async getMyApplications(req, res) {
    try {
      const { volunteerId, submittedById } = req.query;
      const queryVolunteerId = (typeof volunteerId === 'string' && volunteerId.trim())
        ? volunteerId.trim()
        : (typeof submittedById === 'string' ? submittedById.trim() : '');

      if (!queryVolunteerId) {
        return res.status(400).json({
          success: false,
          error: '需要提供 volunteerId 或 submittedById',
          timestamp: new Date().toISOString(),
        });
      }

      const { page = 1, limit = 20, status, includeInactive } = req.query;
      const pagination = QueryUtils.buildPaginationOptions(page, limit);
      const shouldIncludeInactive = String(includeInactive).toLowerCase() === 'true';

      const where = { volunteerId: queryVolunteerId };
      if (!shouldIncludeInactive) where.isActive = true;
      if (status && ['pending', 'approved', 'rejected', 'withdrawn'].includes(status)) {
        where.status = status;
      }

      const [applications, total] = await Promise.all([
        prisma.serviceApplication.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: pagination.skip,
          take: pagination.limit,
        }),
        prisma.serviceApplication.count({ where }),
      ]);

      return res.status(200).json({
        success: true,
        data: {
          applications: applications.map(serializeApplication),
          pagination: {
            page: pagination.page,
            limit: pagination.limit,
            total,
            pages: Math.ceil(total / pagination.limit),
          },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('获取申请列表失败:', error);
      return res.status(500).json({ success: false, error: '获取申请列表失败', timestamp: new Date().toISOString() });
    }
  }

  // POST /api/v1/applications/my/deactivate-all
  static async deactivateAllMyApplications(req, res) {
    try {
      const { volunteerId, submittedById } = req.body;
      const queryVolunteerId = (typeof volunteerId === 'string' && volunteerId.trim())
        ? volunteerId.trim()
        : (typeof submittedById === 'string' ? submittedById.trim() : '');

      if (!queryVolunteerId) {
        return res.status(400).json({
          success: false,
          error: '需要提供 volunteerId 或 submittedById',
          timestamp: new Date().toISOString(),
        });
      }

      const result = await prisma.serviceApplication.updateMany({
        where: { volunteerId: queryVolunteerId, isActive: true },
        data: { isActive: false },
      });

      return res.status(200).json({
        success: true,
        message: '申请记录已清空',
        data: { deactivatedCount: result.count ?? 0 },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('清空申请记录失败:', error);
      return res.status(500).json({ success: false, error: '清空申请记录失败', timestamp: new Date().toISOString() });
    }
  }

  // DELETE /api/v1/applications/:applicationId
  static async withdrawApplication(req, res) {
    try {
      const { applicationId } = req.params;
      const { withdrawnBy } = req.body;

      if (!withdrawnBy || !withdrawnBy.id) {
        return res.status(400).json({ success: false, error: '需要提供撤销人信息', timestamp: new Date().toISOString() });
      }

      const application = await prisma.serviceApplication.findFirst({
        where: { applicationId, status: 'pending' },
      });

      if (!application) {
        return res.status(404).json({ success: false, error: '申请不存在或无法撤销', timestamp: new Date().toISOString() });
      }

      const submittedBy = application.submittedBy;
      const canWithdraw =
        submittedBy?.id === withdrawnBy.id || application.volunteerId === withdrawnBy.id;
      if (!canWithdraw) {
        return res.status(403).json({ success: false, error: '无权撤销该申请', timestamp: new Date().toISOString() });
      }

      const updated = await prisma.serviceApplication.update({
        where: { applicationId },
        data: { status: 'withdrawn', updatedAt: new Date() },
      });

      return res.status(200).json({
        success: true,
        message: '申请已成功撤销',
        data: {
          applicationId: updated.applicationId,
          status: updated.status,
          withdrawnAt: updated.updatedAt,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('撤销申请失败:', error);
      return res.status(500).json({ success: false, error: '撤销申请失败', timestamp: new Date().toISOString() });
    }
  }
}

export default ApplicationController;
