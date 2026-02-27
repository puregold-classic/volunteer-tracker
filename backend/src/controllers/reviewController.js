// src/controllers/reviewController.js
import ServiceApplication from '../models/ServiceApplication.js';
import ReviewService from '../services/ReviewService.js';
import QueryUtils from '../utils/queryUtils.js';

/**
 * 审核控制器
 */
class ReviewController {
  
  /**
   * 获取待审核申请列表
   * GET /api/v1/reviews/pending
   */
  static async getPendingApplications(req, res) {
    try {
      // 从查询参数获取筛选条件
      const filters = {
        volunteerId: req.query.volunteerId,
        volunteerName: req.query.volunteerName,
        applicationType: req.query.applicationType,
        targetType: req.query.targetType,
        submittedBy: req.query.submittedBy,
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo,
        search: req.query.search
      };
      
      // 分页参数
      const { page = 1, limit = 20 } = req.query;
      
      // 排序参数
      const { 
        sortBy = 'createdAt', 
        order = 'asc' 
      } = req.query;
      
      console.log('查询待审核申请:', {
        filters,
        page,
        limit,
        sortBy,
        order,
        reviewer: req.reviewer?.id || 'unknown'
      });
      
      // 步骤1: 构建查询条件
      const query = QueryUtils.buildPendingApplicationsQuery(filters);
      
      // 步骤2: 构建排序和分页选项
      const sortOptions = QueryUtils.buildSortOptions(sortBy, order);
      const pagination = QueryUtils.buildPaginationOptions(page, limit);
      
      // 步骤3: 执行查询（使用聚合管道以获得更好的性能）
      const pipeline = [
        { $match: query },
        { $sort: sortOptions },
        { $skip: pagination.skip },
        { $limit: pagination.limit },
        {
          $project: {
            applicationId: 1,
            applicationType: 1,
            targetType: 1,
            volunteerId: 1,
            volunteerName: 1,
            targetId: 1,
            changes: 1,
            submittedBy: 1,
            status: 1,
            createdAt: 1,
            updatedAt: 1,
            expiresAt: 1,
            // 计算字段
            changesCount: { $size: '$changes' },
            duration: {
              $let: {
                vars: {
                  durationChange: {
                    $arrayElemAt: [
                      { $filter: {
                        input: '$changes',
                        as: 'change',
                        cond: { $eq: ['$$change.field', 'duration'] }
                      }},
                      0
                    ]
                  }
                },
                in: '$$durationChange.to'
              }
            },
            serviceType: {
              $let: {
                vars: {
                  typeChange: {
                    $arrayElemAt: [
                      { $filter: {
                        input: '$changes',
                        as: 'change',
                        cond: { $eq: ['$$change.field', 'serviceType'] }
                      }},
                      0
                    ]
                  }
                },
                in: '$$typeChange.to'
              }
            }
          }
        }
      ];
      
      const applications = await ServiceApplication.aggregate(pipeline);
      
      // 步骤4: 获取总记录数
      const total = await ServiceApplication.countDocuments(query);
      
      // 步骤5: 格式化响应
      const responseData = QueryUtils.formatPaginatedResponse(
        applications,
        total,
        pagination
      );
      
      // 添加审核人信息（如果有）
      if (req.reviewer) {
        responseData.meta = {
          reviewer: req.reviewer,
          queryTime: new Date().toISOString()
        };
      }
      
      return res.status(200).json({
        success: true,
        message: '获取待审核列表成功',
        ...responseData,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('获取待审核列表失败:', error);
      return res.status(500).json({
        success: false,
        error: '获取待审核列表失败',
        detail: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * 获取申请详情（审核时需要）
   * GET /api/v1/applications/:applicationId
   * 注意：这个端点也在applicationController中，但这里提供一个专门用于审核的版本
   */
  static async getApplicationForReview(req, res) {
    try {
      const { applicationId } = req.params;
      
      console.log('获取申请详情用于审核:', {
        applicationId,
        reviewer: req.reviewer?.id || 'unknown'
      });
      
      // 查找申请
      const application = await ServiceApplication.findOne({
        applicationId,
        status: 'pending' // 只允许查看待审核的申请
      });
      
      if (!application) {
        return res.status(404).json({
          success: false,
          error: '申请不存在或已被处理',
          code: 'APPLICATION_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
      }
      
      // 如果是update/delete类型，获取目标记录的当前状态
      let targetRecord = null;
      if (application.targetId && application.applicationType !== 'create') {
        const NonProjectService = (await import('../models/NonProjectService.js')).default;
        targetRecord = await NonProjectService.findOne({
          serviceId: application.targetId,
          isActive: true
        });
      }
      
      // 获取志愿者信息
      const Volunteer = (await import('../models/Volunteer.js')).default;
      const volunteer = await Volunteer.findOne({ 
        id: application.volunteerId 
      });
      
      // 构建响应数据
      const responseData = {
        application: {
          ...application.toObject(),
          // 移除内部字段
          __v: undefined,
          indexedStatus: undefined,
          indexedVolunteerId: undefined,
          indexedDate: undefined
        },
        volunteerInfo: volunteer ? {
          id: volunteer.id,
          chineseName: volunteer.chineseName,
          englishName: volunteer.englishName,
          status: volunteer.status,
          region: volunteer.region,
          nonProjectHours: volunteer.nonProjectHours,
          nonProjectCount: volunteer.nonProjectCount
        } : null,
        targetRecord: targetRecord ? {
          serviceId: targetRecord.serviceId,
          serviceDate: targetRecord.serviceDate,
          serviceType: targetRecord.serviceType,
          duration: targetRecord.duration,
          description: targetRecord.description,
          auditHistory: targetRecord.auditHistory,
          createdAt: targetRecord.createdAt,
          updatedAt: targetRecord.updatedAt
        } : null
      };
      
      return res.status(200).json({
        success: true,
        message: '获取申请详情成功',
        data: responseData,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('获取申请详情失败:', error);
      return res.status(500).json({
        success: false,
        error: '获取申请详情失败',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * 获取审核统计信息
   * GET /api/v1/reviews/stats
   */
  static async getReviewStats(req, res) {
    try {
      console.log('获取审核统计:', {
        reviewer: req.reviewer?.id || 'unknown'
      });
      
      // 使用聚合管道获取统计信息
      const stats = await ServiceApplication.aggregate([
        {
          $facet: {
            // 按状态统计
            byStatus: [
              {
                $group: {
                  _id: '$status',
                  count: { $sum: 1 }
                }
              },
              { $sort: { _id: 1 } }
            ],
            
            // 按申请类型统计（只统计pending）
            byTypePending: [
              {
                $match: { status: 'pending' }
              },
              {
                $group: {
                  _id: '$applicationType',
                  count: { $sum: 1 }
                }
              }
            ],
            
            // 按志愿者统计待审核数量
            byVolunteer: [
              {
                $match: { status: 'pending' }
              },
              {
                $group: {
                  _id: '$volunteerId',
                  count: { $sum: 1 },
                  volunteerName: { $first: '$volunteerName' }
                }
              },
              { $sort: { count: -1 } },
              { $limit: 10 } // 只显示前10名
            ],
            
            // 按提交时间统计（最近7天）
            byDate: [
              {
                $match: {
                  status: 'pending',
                  createdAt: {
                    $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                  }
                }
              },
              {
                $group: {
                  _id: {
                    $dateToString: {
                      format: '%Y-%m-%d',
                      date: '$createdAt'
                    }
                  },
                  count: { $sum: 1 }
                }
              },
              { $sort: { _id: 1 } }
            ],
            
            // 整体统计
            summary: [
              {
                $group: {
                  _id: null,
                  totalPending: {
                    $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
                  },
                  totalProcessed: {
                    $sum: { $cond: [
                      { $in: ['$status', ['approved', 'rejected']] }, 1, 0 
                    ]}
                  },
                  totalWithdrawn: {
                    $sum: { $cond: [{ $eq: ['$status', 'withdrawn'] }, 1, 0] }
                  },
                  total: { $sum: 1 },
                  oldestPending: { $min: '$createdAt' },
                  newestPending: { $max: '$createdAt' }
                }
              }
            ]
          }
        }
      ]);
      
      // 格式化统计结果
      const formattedStats = {
        summary: stats[0].summary[0] || {},
        byStatus: ReviewController.formatStatsArray(stats[0].byStatus),
        byTypePending: ReviewController.formatStatsArray(stats[0].byTypePending),
        byVolunteer: stats[0].byVolunteer,
        byDate: stats[0].byDate,
        meta: {
          generatedAt: new Date().toISOString(),
          reviewer: req.reviewer
        }
      };
      
      // 移除_id字段
      if (formattedStats.summary._id === null) {
        delete formattedStats.summary._id;
      }
      
      return res.status(200).json({
        success: true,
        message: '获取审核统计成功',
        data: formattedStats,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('获取审核统计失败:', error);
      return res.status(500).json({
        success: false,
        error: '获取审核统计失败',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * 获取已处理申请列表
   * GET /api/v1/reviews/processed
   */
  static async getProcessedApplications(req, res) {
    try {
      const filters = {
        volunteerId: req.query.volunteerId,
        applicationType: req.query.applicationType,
        reviewResult: req.query.reviewResult,
        reviewerId: req.query.reviewerId,
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo
      };
      
      const { page = 1, limit = 20 } = req.query;
      const { sortBy = 'updatedAt', order = 'desc' } = req.query;
      
      // 构建查询条件
      const query = QueryUtils.buildProcessedApplicationsQuery(filters);
      const sortOptions = QueryUtils.buildSortOptions(sortBy, order);
      const pagination = QueryUtils.buildPaginationOptions(page, limit);
      
      // 查询已处理的申请
      const applications = await ServiceApplication.find(query)
        .sort(sortOptions)
        .skip(pagination.skip)
        .limit(pagination.limit)
        .select('-__v -indexedStatus -indexedVolunteerId -indexedDate')
        .lean();
      
      const total = await ServiceApplication.countDocuments(query);
      
      // 格式化响应
      const responseData = QueryUtils.formatPaginatedResponse(
        applications,
        total,
        pagination
      );
      
      return res.status(200).json({
        success: true,
        message: '获取已处理列表成功',
        ...responseData,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('获取已处理列表失败:', error);
      return res.status(500).json({
        success: false,
        error: '获取已处理列表失败',
        timestamp: new Date().toISOString()
      });
    }
  }

  // 在 src/controllers/reviewController.js 中新增以下方法

    /**
     * 审核申请（通用）
     * POST /api/v1/reviews/:applicationId
     */
    static async processApplicationReview(req, res) {
    try {
        const { applicationId } = req.params;
        const reviewData = req.body; // { result: 'approved'/'rejected', notes: string }
        const reviewer = req.reviewer;
        
        console.log('处理审核请求:', {
        applicationId,
        result: reviewData.result,
        reviewer: reviewer.id
        });
        
        // 验证审核数据
        if (!reviewData.result || !['approved', 'rejected'].includes(reviewData.result)) {
        return res.status(400).json({
            success: false,
            error: '审核结果必须是 approved 或 rejected',
            code: 'INVALID_REVIEW_RESULT',
            timestamp: new Date().toISOString()
        });
        }
        
        if (!reviewData.notes || reviewData.notes.trim().length === 0) {
        return res.status(400).json({
            success: false,
            error: '审核意见不能为空',
            code: 'EMPTY_REVIEW_NOTES',
            timestamp: new Date().toISOString()
        });
        }
        
        // 调用审核服务
        const result = await ReviewService.reviewApplication(
        applicationId,
        reviewData,
        reviewer
        );
        
        return res.status(200).json({
        success: true,
        message: reviewData.result === 'approved' ? '申请已批准' : '申请已拒绝',
        data: result,
        timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        const statusCode = error.message.includes('不存在') ? 404 : 
                        error.message.includes('已处理') ? 409 : 500;
        if (statusCode >= 500) {
          console.error('处理审核请求失败:', error);
        }
        
        return res.status(statusCode).json({
        success: false,
        error: error.message,
        code: 'REVIEW_PROCESS_FAILED',
        timestamp: new Date().toISOString()
        });
    }
    }

    /**
     * 批量审核
     * POST /api/v1/reviews/batch
     */
    static async batchReviewApplications(req, res) {
    try {
        const { applications } = req.body; // [{ applicationId, reviewData }, ...]
        const reviewer = req.reviewer;
        
        if (!Array.isArray(applications) || applications.length === 0) {
        return res.status(400).json({
            success: false,
            error: '需要提供申请列表',
            code: 'INVALID_BATCH_REQUEST',
            timestamp: new Date().toISOString()
        });
        }
        
        // 验证每个申请的数据
        for (const app of applications) {
        if (!app.applicationId || !app.reviewData || !['approved', 'rejected'].includes(app.reviewData.result)) {
            return res.status(400).json({
            success: false,
            error: '每个申请必须包含 applicationId 和有效的 reviewData',
            code: 'INVALID_APPLICATION_DATA',
            timestamp: new Date().toISOString()
            });
        }
        }
        
        console.log('批量审核请求:', {
        count: applications.length,
        reviewer: reviewer.id
        });
        
        // 调用批量审核服务
        const result = await ReviewService.batchReviewApplications(applications, reviewer);
        
        return res.status(200).json({
        success: true,
        message: '批量审核完成',
        data: result,
        timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('批量审核失败:', error);
        return res.status(500).json({
        success: false,
        error: '批量审核失败',
        detail: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
        });
    }
    }

    /**
     * 重新开启审核
     * POST /api/v1/reviews/:reviewId/reopen
     */
    static async reopenReview(req, res) {
    try {
        const { reviewId } = req.params;
        const reviewer = req.reviewer;
        
        console.log('重新开启审核:', {
        reviewId,
        reviewer: reviewer.id
        });
        
        const result = await ReviewService.reopenReview(reviewId, reviewer);
        
        return res.status(200).json({
        success: true,
        message: '申请已重新开启',
        data: result,
        timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        const statusCode = error.message.includes('不存在') ? 404 : 
                        error.message.includes('只能') ? 400 : 500;
        if (statusCode >= 500) {
          console.error('重新开启审核失败:', error);
        }
        
        return res.status(statusCode).json({
        success: false,
        error: error.message,
        code: 'REOPEN_FAILED',
        timestamp: new Date().toISOString()
        });
    }
    }

    /**
     * 撤回审核结果
     * DELETE /api/v1/reviews/:reviewId
     */
    static async withdrawReview(req, res) {
    try {
        const { reviewId } = req.params;
        const reviewer = req.reviewer;
        
        console.log('撤回审核结果:', {
        reviewId,
        reviewer: reviewer.id
        });
        
        const result = await ReviewService.withdrawReview(reviewId, reviewer);
        
        return res.status(200).json({
        success: true,
        message: '审核结果已撤回',
        data: result,
        timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        const statusCode = error.message.includes('不存在') ? 404 : 
                        error.message.includes('只能') ? 403 : 500;
        if (statusCode >= 500) {
          console.error('撤回审核结果失败:', error);
        }
        
        return res.status(statusCode).json({
        success: false,
        error: error.message,
        code: 'WITHDRAW_FAILED',
        timestamp: new Date().toISOString()
        });
    }
    }
  
  // ========== 辅助方法 ==========
  
  /**
   * 格式化统计数组
   * @private
   */
  static formatStatsArray(statsArray) {
    return statsArray.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});
  }
}



export default ReviewController;
