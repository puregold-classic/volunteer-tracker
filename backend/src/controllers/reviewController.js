// src/controllers/reviewController.js
// Phase 5: Switched from Mongoose to Prisma. Shadow writes removed.

import prisma from '../utils/prismaClient.js';
import ReviewService from '../services/ReviewService.js';
import QueryUtils from '../utils/queryUtils.js';
import { serializeApplication } from '../utils/pgSerializer.js';

class ReviewController {
  /**
   * 获取待审核申请列表
   * GET /api/v1/reviews/pending
   */
  static async getPendingApplications(req, res) {
    try {
      const {
        volunteerId, volunteerName, applicationType, targetType,
        submittedBy, dateFrom, dateTo, search,
        page = 1, limit = 20,
        sortBy = 'createdAt', order = 'asc',
      } = req.query;

      const pagination = QueryUtils.buildPaginationOptions(page, limit);
      const allowedSortFields = ['createdAt', 'updatedAt', 'volunteerName', 'applicationType', 'volunteerId'];
      const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
      const sortOrder = order.toLowerCase() === 'desc' ? 'desc' : 'asc';

      const where = { status: 'pending' };
      if (volunteerId) where.volunteerId = volunteerId;
      if (volunteerName) where.volunteerName = { contains: volunteerName, mode: 'insensitive' };
      if (applicationType && ['create', 'update', 'delete'].includes(applicationType)) {
        where.applicationType = applicationType;
      }
      if (targetType) where.targetType = targetType;
      if (submittedBy) {
        // submittedBy is a JSONB field — filter in JS after query (small set expected)
      }
      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) where.createdAt.gte = new Date(dateFrom);
        if (dateTo) {
          const end = new Date(dateTo);
          end.setHours(23, 59, 59, 999);
          where.createdAt.lte = end;
        }
      }
      if (search && search.trim()) {
        where.OR = [
          { volunteerId: { contains: search.trim(), mode: 'insensitive' } },
          { volunteerName: { contains: search.trim(), mode: 'insensitive' } },
          { applicationId: { contains: search.trim(), mode: 'insensitive' } },
        ];
      }

      let [applications, total] = await Promise.all([
        prisma.serviceApplication.findMany({
          where,
          orderBy: { [sortField]: sortOrder },
          skip: pagination.skip,
          take: pagination.limit,
        }),
        prisma.serviceApplication.count({ where }),
      ]);

      // Filter by submittedBy.id in JS (JSONB)
      if (submittedBy) {
        applications = applications.filter(app => {
          const sb = app.submittedBy || {};
          return sb.id === submittedBy;
        });
      }

      // Enrich with computed fields from changes
      const enriched = applications.map(app => {
        const changes = Array.isArray(app.changes) ? app.changes : [];
        const durationChange = changes.find(c => c.field === 'duration');
        const serviceTypeChange = changes.find(c => c.field === 'serviceType');
        return {
          ...serializeApplication(app),
          changesCount: changes.length,
          duration: durationChange?.to,
          serviceType: serviceTypeChange?.to,
        };
      });

      const responseData = QueryUtils.formatPaginatedResponse(enriched, total, pagination);

      if (req.reviewer) {
        responseData.meta = { reviewer: req.reviewer, queryTime: new Date().toISOString() };
      }

      return res.status(200).json({
        success: true,
        message: '获取待审核列表成功',
        ...responseData,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('获取待审核列表失败:', error);
      return res.status(500).json({
        success: false,
        error: '获取待审核列表失败',
        detail: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * 获取申请详情（审核时需要）
   * GET /api/v1/applications/:applicationId
   */
  static async getApplicationForReview(req, res) {
    try {
      const { applicationId } = req.params;

      const application = await prisma.serviceApplication.findFirst({
        where: { applicationId, status: 'pending' },
      });

      if (!application) {
        return res.status(404).json({
          success: false,
          error: '申请不存在或已被处理',
          code: 'APPLICATION_NOT_FOUND',
          timestamp: new Date().toISOString(),
        });
      }

      let targetRecord = null;
      if (application.targetId && application.applicationType !== 'create') {
        targetRecord = await prisma.nonProjectService.findFirst({
          where: { serviceId: application.targetId, isActive: true },
        });
      }

      const volunteer = await prisma.volunteer.findFirst({
        where: { volunteerId: application.volunteerId },
      });

      return res.status(200).json({
        success: true,
        message: '获取申请详情成功',
        data: {
          application: serializeApplication(application),
          volunteerInfo: volunteer ? {
            id: volunteer.volunteerId,
            chineseName: volunteer.chineseName,
            englishName: volunteer.englishName,
            status: volunteer.status,
            region: volunteer.region,
            nonProjectHours: volunteer.nonProjectHours,
            nonProjectCount: volunteer.nonProjectCount,
          } : null,
          targetRecord: targetRecord ? {
            serviceId: targetRecord.serviceId,
            serviceDate: targetRecord.serviceDate,
            serviceType: targetRecord.serviceType,
            duration: targetRecord.duration,
            description: targetRecord.description,
            auditHistory: targetRecord.auditHistory,
            createdAt: targetRecord.createdAt,
            updatedAt: targetRecord.updatedAt,
          } : null,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('获取申请详情失败:', error);
      return res.status(500).json({
        success: false,
        error: '获取申请详情失败',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * 获取审核统计信息
   * GET /api/v1/reviews/stats
   */
  static async getReviewStats(req, res) {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const [byStatus, byTypePending, byVolunteer, byDate, summary] = await Promise.all([
        // by status
        prisma.serviceApplication.groupBy({
          by: ['status'],
          _count: { id: true },
          orderBy: { status: 'asc' },
        }),
        // by type (pending only)
        prisma.serviceApplication.groupBy({
          by: ['applicationType'],
          where: { status: 'pending' },
          _count: { id: true },
        }),
        // by volunteer (pending, top 10)
        prisma.serviceApplication.groupBy({
          by: ['volunteerId', 'volunteerName'],
          where: { status: 'pending' },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 10,
        }),
        // by date (last 7 days, pending)
        prisma.$queryRaw`
          SELECT TO_CHAR("createdAt", 'YYYY-MM-DD') AS "_id",
                 COUNT(*)::int AS count
          FROM service_applications
          WHERE status = 'pending'
            AND "createdAt" >= ${sevenDaysAgo}
          GROUP BY "_id"
          ORDER BY "_id" ASC
        `,
        // overall summary
        prisma.serviceApplication.aggregate({
          _count: { id: true },
          _min: { createdAt: true },
          _max: { createdAt: true },
        }),
      ]);

      const [pendingCount, processedCount, withdrawnCount] = await Promise.all([
        prisma.serviceApplication.count({ where: { status: 'pending' } }),
        prisma.serviceApplication.count({ where: { status: { in: ['approved', 'rejected'] } } }),
        prisma.serviceApplication.count({ where: { status: 'withdrawn' } }),
      ]);

      const formattedStats = {
        summary: {
          totalPending: pendingCount,
          totalProcessed: processedCount,
          totalWithdrawn: withdrawnCount,
          total: summary._count.id,
          oldestPending: summary._min.createdAt,
          newestPending: summary._max.createdAt,
        },
        byStatus: byStatus.reduce((acc, r) => { acc[r.status] = r._count.id; return acc; }, {}),
        byTypePending: byTypePending.reduce((acc, r) => { acc[r.applicationType] = r._count.id; return acc; }, {}),
        byVolunteer: byVolunteer.map(r => ({
          _id: r.volunteerId,
          volunteerName: r.volunteerName,
          count: r._count.id,
        })),
        byDate,
        meta: { generatedAt: new Date().toISOString(), reviewer: req.reviewer },
      };

      return res.status(200).json({
        success: true,
        message: '获取审核统计成功',
        data: formattedStats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('获取审核统计失败:', error);
      return res.status(500).json({
        success: false,
        error: '获取审核统计失败',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * 获取已处理申请列表
   * GET /api/v1/reviews/processed
   */
  static async getProcessedApplications(req, res) {
    try {
      const {
        volunteerId, applicationType, reviewResult,
        dateFrom, dateTo,
        page = 1, limit = 20,
        sortBy = 'updatedAt', order = 'desc',
      } = req.query;

      const pagination = QueryUtils.buildPaginationOptions(page, limit);
      const allowedSortFields = ['createdAt', 'updatedAt', 'volunteerName', 'applicationType', 'volunteerId'];
      const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'updatedAt';
      const sortOrder = order.toLowerCase() === 'asc' ? 'asc' : 'desc';

      const where = { status: { in: ['approved', 'rejected'] } };
      if (volunteerId) where.volunteerId = volunteerId;
      if (applicationType && ['create', 'update', 'delete'].includes(applicationType)) {
        where.applicationType = applicationType;
      }
      if (reviewResult && ['approved', 'rejected'].includes(reviewResult)) {
        where.status = reviewResult;
      }
      if (dateFrom || dateTo) {
        where.updatedAt = {};
        if (dateFrom) where.updatedAt.gte = new Date(dateFrom);
        if (dateTo) {
          const end = new Date(dateTo);
          end.setHours(23, 59, 59, 999);
          where.updatedAt.lte = end;
        }
      }

      const [applications, total] = await Promise.all([
        prisma.serviceApplication.findMany({
          where,
          orderBy: { [sortField]: sortOrder },
          skip: pagination.skip,
          take: pagination.limit,
        }),
        prisma.serviceApplication.count({ where }),
      ]);

      const responseData = QueryUtils.formatPaginatedResponse(
        applications.map(serializeApplication),
        total,
        pagination
      );

      return res.status(200).json({
        success: true,
        message: '获取已处理列表成功',
        ...responseData,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('获取已处理列表失败:', error);
      return res.status(500).json({
        success: false,
        error: '获取已处理列表失败',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * 审核申请（通用）
   * POST /api/v1/reviews/:applicationId
   */
  static async processApplicationReview(req, res) {
    try {
      const { applicationId } = req.params;
      const reviewData = req.body;
      const reviewer = req.reviewer;

      if (!reviewData.result || !['approved', 'rejected'].includes(reviewData.result)) {
        return res.status(400).json({
          success: false,
          error: '审核结果必须是 approved 或 rejected',
          code: 'INVALID_REVIEW_RESULT',
          timestamp: new Date().toISOString(),
        });
      }
      if (!reviewData.notes || reviewData.notes.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: '审核意见不能为空',
          code: 'EMPTY_REVIEW_NOTES',
          timestamp: new Date().toISOString(),
        });
      }

      const result = await ReviewService.reviewApplication(applicationId, reviewData, reviewer);

      return res.status(200).json({
        success: true,
        message: reviewData.result === 'approved' ? '申请已批准' : '申请已拒绝',
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const statusCode = error.message.includes('不存在') ? 404 :
        error.message.includes('已处理') ? 409 : 500;
      if (statusCode >= 500) console.error('处理审核请求失败:', error);
      return res.status(statusCode).json({
        success: false,
        error: error.message,
        code: 'REVIEW_PROCESS_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * 批量审核
   * POST /api/v1/reviews/batch
   */
  static async batchReviewApplications(req, res) {
    try {
      const { applications } = req.body;
      const reviewer = req.reviewer;

      if (!Array.isArray(applications) || applications.length === 0) {
        return res.status(400).json({
          success: false,
          error: '需要提供申请列表',
          code: 'INVALID_BATCH_REQUEST',
          timestamp: new Date().toISOString(),
        });
      }
      for (const app of applications) {
        if (!app.applicationId || !app.reviewData || !['approved', 'rejected'].includes(app.reviewData.result)) {
          return res.status(400).json({
            success: false,
            error: '每个申请必须包含 applicationId 和有效的 reviewData',
            code: 'INVALID_APPLICATION_DATA',
            timestamp: new Date().toISOString(),
          });
        }
      }

      const result = await ReviewService.batchReviewApplications(applications, reviewer);

      return res.status(200).json({
        success: true,
        message: '批量审核完成',
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('批量审核失败:', error);
      return res.status(500).json({
        success: false,
        error: '批量审核失败',
        detail: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString(),
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
      const result = await ReviewService.reopenReview(reviewId, reviewer);

      return res.status(200).json({
        success: true,
        message: '申请已重新开启',
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const statusCode = error.message.includes('不存在') ? 404 :
        error.message.includes('只能') ? 400 : 500;
      if (statusCode >= 500) console.error('重新开启审核失败:', error);
      return res.status(statusCode).json({
        success: false,
        error: error.message,
        code: 'REOPEN_FAILED',
        timestamp: new Date().toISOString(),
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
      const result = await ReviewService.withdrawReview(reviewId, reviewer);

      return res.status(200).json({
        success: true,
        message: '审核结果已撤回',
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const statusCode = error.message.includes('不存在') ? 404 :
        error.message.includes('只能') ? 403 : 500;
      if (statusCode >= 500) console.error('撤回审核结果失败:', error);
      return res.status(statusCode).json({
        success: false,
        error: error.message,
        code: 'WITHDRAW_FAILED',
        timestamp: new Date().toISOString(),
      });
    }
  }
}

export default ReviewController;
