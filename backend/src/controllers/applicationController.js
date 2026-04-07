import * as ApplicationService from '../services/ApplicationService.js';

class ApplicationController {
  static async submitApplication(req, res) {
    try {
      const applicationData = req.body;
      const { submittedBy } = applicationData;
      console.log('收到申请提交请求:', { type: applicationData.applicationType, volunteer: applicationData.volunteerId, submittedBy: submittedBy?.id });

      const result = await ApplicationService.submitApplication(applicationData);

      if (result.validationError) {
        return res.status(400).json({ success: false, error: result.validationError, timestamp: new Date().toISOString() });
      }
      if (result.conflictError) {
        return res.status(409).json({ success: false, error: result.conflictError, code: 'PENDING_PROJECT_CONFLICT', timestamp: new Date().toISOString() });
      }

      const saved = result.application;
      console.log('申请提交成功:', { applicationId: saved.applicationId, volunteerId: saved.volunteerId, type: saved.applicationType });

      return res.status(201).json({
        success: true,
        message: '申请提交成功，等待审核',
        data: {
          applicationId: saved.applicationId,
          status: saved.status,
          submittedAt: saved.createdAt,
          volunteerId: saved.volunteerId,
          volunteerName: saved.volunteerName,
          applicationType: saved.applicationType,
          expiresAt: saved.expiresAt,
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

  static async validateApplication(req, res) {
    try {
      const applicationData = req.body;
      const validationResult = await ApplicationService.validateApplication(applicationData);

      if (!validationResult.isValid) {
        return res.status(400).json({ success: false, isValid: false, error: validationResult.error, timestamp: new Date().toISOString() });
      }
      return res.status(200).json({
        success: true, isValid: true, message: validationResult.message,
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

  static async getMyApplications(req, res) {
    try {
      const result = await ApplicationService.getMyApplications(req.query);
      if (result.missingId) {
        return res.status(400).json({ success: false, error: '需要提供 volunteerId 或 submittedById', timestamp: new Date().toISOString() });
      }
      return res.status(200).json({ success: true, data: result, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error('获取申请列表失败:', error);
      return res.status(500).json({ success: false, error: '获取申请列表失败', timestamp: new Date().toISOString() });
    }
  }

  static async deactivateAllMyApplications(req, res) {
    try {
      const result = await ApplicationService.deactivateAllMyApplications(req.body);
      if (result.missingId) {
        return res.status(400).json({ success: false, error: '需要提供 volunteerId 或 submittedById', timestamp: new Date().toISOString() });
      }
      return res.status(200).json({ success: true, message: '申请记录已清空', data: { deactivatedCount: result.deactivatedCount }, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error('清空申请记录失败:', error);
      return res.status(500).json({ success: false, error: '清空申请记录失败', timestamp: new Date().toISOString() });
    }
  }

  static async withdrawApplication(req, res) {
    try {
      const { applicationId } = req.params;
      const { withdrawnBy } = req.body;
      const result = await ApplicationService.withdrawApplication({ applicationId, withdrawnBy });

      if (result.missingWithdrawnBy) {
        return res.status(400).json({ success: false, error: '需要提供撤销人信息', timestamp: new Date().toISOString() });
      }
      if (result.notFound) {
        return res.status(404).json({ success: false, error: '申请不存在或无法撤销', timestamp: new Date().toISOString() });
      }
      if (result.forbidden) {
        return res.status(403).json({ success: false, error: '无权撤销该申请', timestamp: new Date().toISOString() });
      }

      const updated = result.application;
      return res.status(200).json({
        success: true, message: '申请已成功撤销',
        data: { applicationId: updated.applicationId, status: updated.status, withdrawnAt: updated.updatedAt },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('撤销申请失败:', error);
      return res.status(500).json({ success: false, error: '撤销申请失败', timestamp: new Date().toISOString() });
    }
  }
}

export default ApplicationController;
