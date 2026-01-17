// src/controllers/applicationController.js
import ServiceApplication from '../models/ServiceApplication.js';
import ValidationUtils from '../utils/validationUtils.js';
import { IDGenerator } from '../utils/idUtils.js';

/**
 * 申请控制器
 */
class ApplicationController {
  
  /**
   * 提交申请
   * POST /api/v1/applications
   */
  static async submitApplication(req, res) {
    try {
      const applicationData = req.body;
      const { submittedBy } = applicationData;
      
      console.log('收到申请提交请求:', {
        type: applicationData.applicationType,
        volunteer: applicationData.volunteerId,
        submittedBy: submittedBy.id
      });
      
      // 步骤1: 业务逻辑验证
      const validationResult = await ValidationUtils.validateApplicationData(applicationData);
      
      if (!validationResult.isValid) {
        console.log('申请验证失败:', validationResult.error);
        return res.status(400).json({
          success: false,
          error: validationResult.error,
          timestamp: new Date().toISOString()
        });
      }
      
      // 步骤2: 生成申请ID
      const applicationId = await IDGenerator.generateApplicationId(submittedBy.id);
      
      // 步骤3: 构建申请文档
      const applicationDoc = {
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
          timestamp: new Date()
        },
        status: 'pending',
        reviewNotes: '',
        expiresAt: null, // 永不超时
        indexedVolunteerId: applicationData.volunteerId,
        indexedStatus: 'pending',
        indexedDate: new Date()
      };
      
      // 步骤4: 保存到数据库
      const savedApplication = await ServiceApplication.create(applicationDoc);
      
      console.log('申请提交成功:', {
        applicationId: savedApplication.applicationId,
        volunteerId: savedApplication.volunteerId,
        type: savedApplication.applicationType
      });
      
      // 步骤5: 返回成功响应
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
          expiresAt: savedApplication.expiresAt
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('申请提交失败:', error);
      
      // 处理重复ID错误
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          error: '申请ID冲突，请重试',
          timestamp: new Date().toISOString()
        });
      }
      
      // 处理验证错误
      if (error.name === 'ValidationError') {
        const firstError = Object.values(error.errors)[0];
        return res.status(400).json({
          success: false,
          error: firstError.message,
          timestamp: new Date().toISOString()
        });
      }
      
      // 其他服务器错误
      return res.status(500).json({
        success: false,
        error: '服务器内部错误',
        detail: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * 申请预验证
   * POST /api/v1/applications/validate
   */
  static async validateApplication(req, res) {
    try {
      const applicationData = req.body;
      
      console.log('收到预验证请求:', {
        type: applicationData.applicationType,
        volunteer: applicationData.volunteerId
      });
      
      // 执行验证
      const validationResult = await ValidationUtils.validateApplicationData(applicationData);
      
      if (!validationResult.isValid) {
        return res.status(400).json({
          success: false,
          isValid: false,
          error: validationResult.error,
          timestamp: new Date().toISOString()
        });
      }
      
      // 返回验证通过
      return res.status(200).json({
        success: true,
        isValid: true,
        message: validationResult.message,
        data: {
          volunteerId: applicationData.volunteerId,
          volunteerName: applicationData.volunteerName,
          applicationType: applicationData.applicationType,
          changesCount: applicationData.changes?.length || 0
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('预验证失败:', error);
      return res.status(500).json({
        success: false,
        isValid: false,
        error: '预验证过程中发生错误',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * 获取我的申请列表
   * GET /api/v1/applications/my
   */
  static async getMyApplications(req, res) {
    try {
      const { submittedById } = req.query;
      
      if (!submittedById) {
        return res.status(400).json({
          success: false,
          error: '需要提供提交人ID',
          timestamp: new Date().toISOString()
        });
      }
      
      const { page = 1, limit = 20, status } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      // 构建查询条件
      const query = {
        'submittedBy.id': submittedById
      };
      
      // 状态筛选
      if (status && ['pending', 'approved', 'rejected', 'withdrawn'].includes(status)) {
        query.status = status;
      }
      
      // 执行查询
      const applications = await ServiceApplication.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-__v -indexedStatus -indexedVolunteerId -indexedDate')
        .lean();
      
      // 获取总数
      const total = await ServiceApplication.countDocuments(query);
      
      return res.status(200).json({
        success: true,
        data: {
          applications,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
          }
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('获取申请列表失败:', error);
      return res.status(500).json({
        success: false,
        error: '获取申请列表失败',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * 撤销申请
   * DELETE /api/v1/applications/:applicationId
   */
  static async withdrawApplication(req, res) {
    try {
      const { applicationId } = req.params;
      const { withdrawnBy } = req.body; // { id, name, role }
      
      if (!withdrawnBy || !withdrawnBy.id) {
        return res.status(400).json({
          success: false,
          error: '需要提供撤销人信息',
          timestamp: new Date().toISOString()
        });
      }
      
      // 查找申请
      const application = await ServiceApplication.findOne({
        applicationId,
        status: 'pending'
      });
      
      if (!application) {
        return res.status(404).json({
          success: false,
          error: '申请不存在或无法撤销',
          timestamp: new Date().toISOString()
        });
      }
      
      // 验证撤销权限（只能撤销自己提交的申请）
      if (application.submittedBy.id !== withdrawnBy.id) {
        return res.status(403).json({
          success: false,
          error: '只能撤销自己提交的申请',
          timestamp: new Date().toISOString()
        });
      }
      
      // 更新状态
      application.status = 'withdrawn';
      application.updatedAt = new Date();
      application.indexedStatus = 'withdrawn';
      
      await application.save();
      
      // TODO: 记录审计日志（未来实现）
      
      return res.status(200).json({
        success: true,
        message: '申请已成功撤销',
        data: {
          applicationId: application.applicationId,
          status: application.status,
          withdrawnAt: application.updatedAt
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('撤销申请失败:', error);
      return res.status(500).json({
        success: false,
        error: '撤销申请失败',
        timestamp: new Date().toISOString()
      });
    }
  }
}

export default ApplicationController;