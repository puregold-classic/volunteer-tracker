// src/services/AuditService.js
// Phase 5: Switched from Mongoose to Prisma. Shadow writes removed.
// Complex $facet/$lookup aggregations replaced with parallel Prisma queries
// and prisma.$queryRaw for date-based groupings.

import prisma from '../utils/prismaClient.js';
import QueryUtils from '../utils/queryUtils.js';

/**
 * Build a Prisma `where` clause for AuditLog from API filter params.
 * AuditLog has JSONB fields (operator, submitter, actionDetails) —
 * Prisma cannot filter on nested JSONB keys natively, so those require $queryRaw.
 * For the most common filters we use top-level fields; JSONB filters degrade gracefully.
 */
const buildAuditWhere = (filters = {}) => {
  const {
    targetType,
    targetId,
    modifiedId,
    action,
    dateFrom,
    dateTo,
  } = filters;

  const where = {};

  if (targetType) where.targetType = targetType;
  if (targetId) where.targetId = targetId;
  if (modifiedId) {
    where.modifiedId = modifiedId === 'null' ? null : modifiedId;
  }
  if (action) {
    const actions = String(action).split(',').map(a => a.trim()).filter(Boolean);
    if (actions.length === 1) where.action = actions[0];
    else if (actions.length > 1) where.action = { in: actions };
  }
  if (dateFrom || dateTo) {
    where.timestamp = {};
    if (dateFrom) where.timestamp.gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      where.timestamp.lte = end;
    }
  }

  return where;
};

class AuditService {
  /**
   * 获取审计日志列表
   */
  static async getAuditLogs(filters = {}, pagination = {}, sortOptions = {}) {
    try {
      const { page = 1, limit = 20 } = pagination;
      const { sortBy = 'timestamp', order = 'desc' } = sortOptions;
      const pg = QueryUtils.buildPaginationOptions(page, limit);

      const allowedSortFields = ['timestamp', 'auditId', 'targetId', 'modifiedId'];
      const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'timestamp';
      const sortOrder = order.toLowerCase() === 'asc' ? 'asc' : 'desc';

      const where = buildAuditWhere(filters);

      const [auditLogs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { [sortField]: sortOrder },
          skip: pg.skip,
          take: pg.limit,
        }),
        prisma.auditLog.count({ where }),
      ]);

      return {
        auditLogs: auditLogs.map(log => this.serializeLog(log)),
        pagination: {
          page: pg.page,
          limit: pg.limit,
          total,
          totalPages: Math.ceil(total / pg.limit),
          hasNext: pg.page * pg.limit < total,
          hasPrev: pg.page > 1,
        },
      };
    } catch (error) {
      console.error('获取审计日志列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取审计日志详情（含关联申请和服务记录）
   */
  static async getAuditLogById(auditId) {
    try {
      const log = await prisma.auditLog.findFirst({ where: { auditId } });
      if (!log) {
        throw new Error(`审计日志不存在: ${auditId}`);
      }

      const operator = log.operator || {};
      const submitter = log.submitter || {};

      const [operatorVolunteer, submitterVolunteer, relatedApplication, relatedService] = await Promise.all([
        operator.id ? prisma.volunteer.findFirst({
          where: { volunteerId: operator.id },
          select: { volunteerId: true, chineseName: true, englishName: true, role: true, region: true, status: true },
        }) : null,
        submitter.id ? prisma.volunteer.findFirst({
          where: { volunteerId: submitter.id },
          select: { volunteerId: true, chineseName: true, englishName: true, role: true, region: true, status: true },
        }) : null,
        log.targetId ? prisma.serviceApplication.findFirst({
          where: { applicationId: log.targetId },
          select: { applicationId: true, applicationType: true, volunteerId: true, volunteerName: true, status: true, createdAt: true },
        }) : null,
        log.modifiedId ? prisma.nonProjectService.findFirst({
          where: { serviceId: log.modifiedId },
          select: { serviceId: true, serviceDate: true, serviceType: true, duration: true, description: true, isActive: true },
        }) : null,
      ]);

      const changes = Array.isArray(log.changes) ? log.changes : [];

      return {
        ...this.serializeLog(log),
        operator: {
          id: operator.id,
          name: operator.name,
          role: operator.role,
          details: operatorVolunteer,
        },
        submitter: {
          id: submitter.id,
          name: submitter.name,
          role: submitter.role,
          details: submitterVolunteer,
        },
        relatedApplication: relatedApplication || null,
        relatedService: relatedService || null,
        changeAnalysis: changes.length > 0 ? {
          fields: changes.map(c => c.field),
          fromValues: changes.map(c => c.from),
          toValues: changes.map(c => c.to),
        } : null,
      };
    } catch (error) {
      console.error('获取审计日志详情失败:', error);
      throw error;
    }
  }

  /**
   * 获取目标的审计历史
   */
  static async getTargetAuditHistory(targetType, targetId) {
    try {
      const validTargetTypes = ['ServiceApplication', 'NonProjectService', 'Volunteer'];
      if (!validTargetTypes.includes(targetType)) {
        throw new Error(`无效的目标类型: ${targetType}`);
      }

      const auditHistory = await prisma.auditLog.findMany({
        where: {
          OR: [
            { targetType, targetId },
            { modifiedId: targetId },
          ],
        },
        orderBy: { timestamp: 'desc' },
      });

      // Enrich with operator volunteer info
      const enriched = await Promise.all(auditHistory.map(async (log) => {
        const operator = log.operator || {};
        const operatorInfo = operator.id ? await prisma.volunteer.findFirst({
          where: { volunteerId: operator.id },
          select: { volunteerId: true, chineseName: true, role: true },
        }) : null;

        const actionDescriptions = {
          application_review: `审核了申请 ${log.targetId}，结果: ${(log.actionDetails || {}).reviewResult || ''}`,
          application_withdraw: `撤销了申请 ${log.targetId}`,
          application_reopen: `重新开启了申请 ${log.targetId}`,
          review_withdraw: `撤回了审核 ${log.targetId}`,
        };
        const description = actionDescriptions[log.action] || `执行了操作: ${log.action}`;

        return {
          ...this.serializeLog(log),
          operator: { id: operator.id, name: operator.name, role: operator.role, details: operatorInfo },
          description,
        };
      }));

      return {
        targetType,
        targetId,
        history: enriched,
        count: enriched.length,
        latest: enriched.length > 0 ? enriched[0].timestamp : null,
        earliest: enriched.length > 0 ? enriched[enriched.length - 1].timestamp : null,
      };
    } catch (error) {
      console.error('获取目标审计历史失败:', error);
      throw error;
    }
  }

  /**
   * 获取审计统计总览
   */
  static async getAuditStatistics(filters = {}) {
    try {
      const where = buildAuditWhere(filters);

      const [total, byAction, byTargetType, byDay, byMonth] = await Promise.all([
        prisma.auditLog.count({ where }),
        prisma.auditLog.groupBy({
          by: ['action'],
          where,
          _count: { id: true },
          _max: { timestamp: true },
          orderBy: { _count: { id: 'desc' } },
        }),
        prisma.auditLog.groupBy({
          by: ['targetType'],
          where,
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
        }),
        // by day (last 30)
        prisma.$queryRaw`
          SELECT TO_CHAR(timestamp, 'YYYY-MM-DD') AS period,
                 COUNT(*)::int AS count
          FROM audit_logs
          GROUP BY period
          ORDER BY period DESC
          LIMIT 30
        `,
        // by month (last 12)
        prisma.$queryRaw`
          SELECT TO_CHAR(timestamp, 'YYYY-MM') AS period,
                 EXTRACT(YEAR FROM timestamp)::int AS year,
                 EXTRACT(MONTH FROM timestamp)::int AS month,
                 COUNT(*)::int AS count
          FROM audit_logs
          GROUP BY period, year, month
          ORDER BY period ASC
          LIMIT 12
        `,
      ]);

      const [minMax] = await Promise.all([
        prisma.auditLog.aggregate({
          where,
          _min: { timestamp: true },
          _max: { timestamp: true },
        }),
      ]);

      return {
        summary: {
          totalLogs: total,
          earliestDate: minMax._min.timestamp,
          latestDate: minMax._max.timestamp,
        },
        byAction: byAction.reduce((acc, r) => {
          acc[r.action] = { count: r._count.id, lastActivity: r._max.timestamp };
          return acc;
        }, {}),
        byTargetType: byTargetType.reduce((acc, r) => {
          acc[r.targetType] = { count: r._count.id };
          return acc;
        }, {}),
        byDay,
        byMonth,
        generatedAt: new Date().toISOString(),
        filters,
      };
    } catch (error) {
      console.error('获取审计统计失败:', error);
      throw error;
    }
  }

  /**
   * 获取操作人审计统计
   */
  static async getOperatorAuditStatistics(operatorId) {
    try {
      const volunteer = await prisma.volunteer.findFirst({ where: { volunteerId: operatorId } });
      if (!volunteer) {
        throw new Error(`操作人不存在: ${operatorId}`);
      }

      // Filter by operator.id in JSONB — requires raw query
      const [summary, byAction, recentActivity] = await Promise.all([
        prisma.$queryRaw`
          SELECT COUNT(*)::int AS "totalLogs",
                 MIN(timestamp) AS "firstActivity",
                 MAX(timestamp) AS "lastActivity"
          FROM audit_logs
          WHERE operator->>'id' = ${operatorId}
        `,
        prisma.$queryRaw`
          SELECT action,
                 COUNT(*)::int AS count,
                 MAX(timestamp) AS "lastPerformed"
          FROM audit_logs
          WHERE operator->>'id' = ${operatorId}
          GROUP BY action
          ORDER BY count DESC
        `,
        prisma.$queryRaw`
          SELECT TO_CHAR(timestamp, 'YYYY-MM-DD') AS period,
                 COUNT(*)::int AS count
          FROM audit_logs
          WHERE operator->>'id' = ${operatorId}
            AND timestamp >= NOW() - INTERVAL '30 days'
          GROUP BY period
          ORDER BY period DESC
        `,
      ]);

      return {
        operator: {
          id: volunteer.volunteerId,
          name: volunteer.chineseName,
          role: volunteer.role,
          region: volunteer.region,
        },
        summary: summary[0] || {},
        byAction: (byAction || []).reduce((acc, r) => {
          acc[r.action] = { count: r.count, lastPerformed: r.lastPerformed };
          return acc;
        }, {}),
        recentActivity,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('获取操作人审计统计失败:', error);
      throw error;
    }
  }

  /**
   * 获取审计时间线分析
   */
  static async getAuditTimelineAnalysis(filters = {}) {
    try {
      const timelineData = await prisma.$queryRaw`
        SELECT TO_CHAR(timestamp, 'YYYY-MM-DD') AS date,
               EXTRACT(HOUR FROM timestamp)::int AS hour,
               COUNT(*)::int AS count
        FROM audit_logs
        GROUP BY date, hour
        ORDER BY date ASC, hour ASC
        LIMIT 720
      `;

      // Group by date
      const byDate = {};
      for (const row of timelineData) {
        if (!byDate[row.date]) {
          byDate[row.date] = { date: row.date, dailyCount: 0, hourlyData: [] };
        }
        byDate[row.date].dailyCount += row.count;
        byDate[row.date].hourlyData.push({ hour: row.hour, count: row.count });
      }

      const timeline = Object.values(byDate).slice(-30);
      const total = timeline.reduce((sum, d) => sum + d.dailyCount, 0);

      return {
        timeline,
        statistics: {
          totalDays: timeline.length,
          totalLogs: total,
          avgLogsPerDay: timeline.length > 0 ? Math.round(total / timeline.length * 100) / 100 : 0,
          busiestDay: timeline.length > 0 ? timeline.reduce((max, d) => d.dailyCount > max.dailyCount ? d : max, timeline[0]) : null,
        },
        generatedAt: new Date().toISOString(),
        filters,
      };
    } catch (error) {
      console.error('获取审计时间线分析失败:', error);
      throw error;
    }
  }

  /**
   * 导出审计日志
   */
  static async exportAuditLogs(filters = {}) {
    try {
      const where = buildAuditWhere(filters);
      const auditLogs = await prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
      });

      const exportData = auditLogs.map(log => {
        const operator = log.operator || {};
        const submitter = log.submitter || {};
        const actionDetails = log.actionDetails || {};
        const changes = Array.isArray(log.changes) ? log.changes : [];
        return {
          '审计ID': log.auditId,
          '目标类型': log.targetType,
          '目标ID': log.targetId,
          '操作类型': log.action,
          '申请类型': actionDetails.applicationType || '',
          '审核结果': actionDetails.reviewResult || '',
          '审核意见': actionDetails.reviewNote || '',
          '修改记录ID': log.modifiedId || '',
          '变更数量': changes.length,
          '操作人ID': operator.id || '',
          '操作人姓名': operator.name || '',
          '操作人角色': operator.role || '',
          '提交人ID': submitter.id || '',
          '提交人姓名': submitter.name || '',
          '提交人角色': submitter.role || '',
          '操作时间': new Date(log.timestamp).toLocaleString('zh-CN'),
          '变更摘要': changes.length > 0 ? `变更了 ${changes.length} 个字段` : '无数据变更',
          '导出时间': new Date().toLocaleString('zh-CN'),
        };
      });

      return {
        data: exportData,
        count: exportData.length,
        generatedAt: new Date().toISOString(),
        filters,
        format: 'CSV-ready',
      };
    } catch (error) {
      console.error('导出审计日志失败:', error);
      throw error;
    }
  }

  // ========== 辅助方法 ==========

  /**
   * Serialize a Prisma AuditLog record for API response.
   * @private
   */
  static serializeLog(log) {
    if (!log) return null;
    const changes = Array.isArray(log.changes) ? log.changes : [];
    return {
      auditId: log.auditId,
      targetType: log.targetType,
      targetId: log.targetId,
      action: log.action,
      actionDetails: log.actionDetails,
      modifiedId: log.modifiedId,
      changes,
      operator: log.operator,
      submitter: log.submitter,
      timestamp: log.timestamp,
      hasChanges: changes.length > 0,
      changeCount: changes.length,
      changeSummary: changes.length > 0 ? `变更了 ${changes.length} 个字段` : '无数据变更',
    };
  }
}

export default AuditService;
