// src/services/AuditService.js — v2.1
//
// Read-only access to AuditLog. The write side lives inside each service that
// produces an action (ProjectSupportService, AccountService, SystemSettings...).
//
// Updated for v2.1 actions: support_create / support_update / support_delete /
// support_confirm / support_reject / volunteer_create / volunteer_update /
// volunteer_deactivate / account_create / account_update / month_lock /
// system_cleanup / seed_import.

import prisma from '../utils/prismaClient.js';
import QueryUtils from '../utils/queryUtils.js';

export const FORUM_AUDIT_TARGETS = ['Circle', 'Post', 'PostComment'];

// Ledger reviewers do not acquire forum powers through the audit API. Forum
// audit snapshots (including moderation edits) are system-admin-only here.
const restrictForumAudits = (where, viewer) => viewer?.role === 'admin'
  ? where
  : { AND: [where, { targetType: { notIn: FORUM_AUDIT_TARGETS } }] };

const ACTION_DESCRIPTIONS = {
  training_create: () => '创建了培训场次',
  training_update: () => '修改了培训场次并同步有效考勤',
  training_add: () => '补录了培训参加人员',
  training_remove: () => '移除了培训考勤',
  training_restore: () => '恢复了培训考勤',
  training_migrate: () => '将历史受训记录迁移至培训场次',
  tag_attach: () => '更新了服务记录的标签关联',
  tag_detach: () => '解除了服务记录的标签关联',
  support_create:       (log) => `创建项目服务记录 ${log.modifiedId || ''}`,
  support_update:       (log) => `修改项目服务记录 ${log.modifiedId || ''}`,
  support_delete:       (log) => `删除项目服务记录 ${log.modifiedId || ''}`,
  support_confirm:      (log) => `确认了代提交的项目服务 ${log.modifiedId || ''}`,
  support_reject:       (log) => `拒绝了代提交的项目服务 ${log.modifiedId || ''}`,
  volunteer_create:     ()    => `创建了志愿者档案`,
  volunteer_update:     ()    => `修改了志愿者档案`,
  volunteer_deactivate: ()    => `停用了志愿者`,
  account_create:       ()    => `创建了账号`,
  account_update:       ()    => `修改了账号`,
  month_lock:           (log) => `执行月结封档（lockedBefore=${log.actionDetails?.lockedBefore || ''}）`,
  system_cleanup:       ()    => `执行系统清理`,
  seed_import:          ()    => `执行 seed 数据导入`,
  circle_create:        ()    => '创建了圈子',
  circle_update:        ()    => '修改了圈子资料',
  circle_archive:       ()    => '归档了圈子',
  circle_restore:       ()    => '恢复了圈子',
  circle_role_assign:   ()    => '任命了圈务成员',
  circle_role_remove:   ()    => '移除了圈务成员',
  circle_ownership_transfer: () => '转让了圈主身份',
  post_moderation_edit: () => '管理编辑了帖子',
  post_moderation_delete: () => '管理删除了帖子',
  post_moderation_restore: () => '恢复了帖子',
  comment_moderation_edit: () => '管理编辑了评论',
  comment_moderation_delete: () => '管理删除了评论',
  comment_moderation_restore: () => '恢复了评论',
  comment_pin: () => '帖主置顶了评论',
  comment_unpin: () => '帖主取消置顶了评论',
  post_pin: () => '置顶了帖子',
  post_unpin: () => '取消了帖子置顶',
  post_feature: () => '将帖子设为精华',
  post_unfeature: () => '取消了帖子精华',
};

const buildAuditWhere = (filters = {}) => {
  const { targetType, targetId, modifiedId, action, dateFrom, dateTo } = filters;
  const where = {};

  if (targetType) where.targetType = targetType;
  if (targetId) where.targetId = targetId;
  if (modifiedId) where.modifiedId = modifiedId === 'null' ? null : modifiedId;

  if (action) {
    const actions = String(action).split(',').map((a) => a.trim()).filter(Boolean);
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
  static async getAuditLogs(filters = {}, pagination = {}, sortOptions = {}, viewer = null) {
    const { page = 1, limit = 20 } = pagination;
    const { sortBy = 'timestamp', order = 'desc' } = sortOptions;
    const pg = QueryUtils.buildPaginationOptions(page, limit);

    const allowedSortFields = ['timestamp', 'auditId', 'targetId', 'modifiedId'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'timestamp';
    const sortOrder = order.toLowerCase() === 'asc' ? 'asc' : 'desc';

    const where = restrictForumAudits(buildAuditWhere(filters), viewer);

    const [auditLogs, total] = await Promise.all([
      prisma.auditLog.findMany({ where, orderBy: { [sortField]: sortOrder }, skip: pg.skip, take: pg.limit }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      auditLogs: auditLogs.map((log) => this.serializeLog(log)),
      pagination: {
        page: pg.page,
        limit: pg.limit,
        total,
        totalPages: Math.ceil(total / pg.limit),
        hasNext: pg.page * pg.limit < total,
        hasPrev: pg.page > 1,
      },
    };
  }

  static async getAuditLogById(auditId, viewer = null) {
    const log = await prisma.auditLog.findFirst({ where: restrictForumAudits({ auditId }, viewer) });
    if (!log) throw new Error(`审计日志不存在: ${auditId}`);

    const operator = log.operator || {};
    const submitter = log.submitter || {};

    // Best-effort enrichment with the related volunteer / support row.
    const [operatorVolunteer, submitterVolunteer, relatedSupport] = await Promise.all([
      operator.volunteerId
        ? prisma.volunteer.findUnique({
            where: { id: operator.volunteerId },
            select: { id: true, volunteerCode: true, chineseName: true, departmentId: true },
          })
        : null,
      submitter.volunteerId
        ? prisma.volunteer.findUnique({
            where: { id: submitter.volunteerId },
            select: { id: true, volunteerCode: true, chineseName: true, departmentId: true },
          })
        : null,
      log.modifiedId
        ? prisma.projectSupport.findUnique({
            where: { supportId: log.modifiedId },
            select: { supportId: true, serviceDate: true, duration: true, description: true, status: true },
          })
        : null,
    ]);

    return {
      ...this.serializeLog(log),
      operator: { ...operator, details: operatorVolunteer },
      submitter: { ...submitter, details: submitterVolunteer },
      relatedSupport,
    };
  }

  /** Audit history for a specific target (e.g. one ProjectSupport row). */
  static async getTargetAuditHistory(targetType, targetId, viewer = null) {
    const validTargetTypes = ['ProjectSupport', 'TrainingSession', 'Volunteer', 'Account', 'SystemSettings', ...FORUM_AUDIT_TARGETS];
    if (!validTargetTypes.includes(targetType)) {
      throw new Error(`无效的目标类型: ${targetType}`);
    }

    const auditHistory = await prisma.auditLog.findMany({
      where: restrictForumAudits({
        OR: [
          { targetType, targetId },
          { modifiedId: targetId },
        ],
      }, viewer),
      orderBy: { timestamp: 'desc' },
    });

    const enriched = auditHistory.map((log) => ({
      ...this.serializeLog(log),
      description: (ACTION_DESCRIPTIONS[log.action] || ((l) => `操作: ${l.action}`))(log),
    }));

    return {
      targetType,
      targetId,
      history: enriched,
      count: enriched.length,
      latest: enriched[0]?.timestamp ?? null,
      earliest: enriched.at(-1)?.timestamp ?? null,
    };
  }

  /** Aggregate stats over the audit log. Used by admin dashboards. */
  static async getAuditStatistics(filters = {}, viewer = null) {
    const where = restrictForumAudits(buildAuditWhere(filters), viewer);

    const [total, byAction, byTargetType, byDay] = await Promise.all([
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
      prisma.$queryRaw`
        SELECT TO_CHAR(timestamp, 'YYYY-MM-DD') AS period,
               COUNT(*)::int AS count
        FROM audit_logs
        WHERE (${viewer?.role === 'admin'} OR "targetType"::text NOT IN ('Circle', 'Post', 'PostComment'))
        GROUP BY period
        ORDER BY period DESC
        LIMIT 30
      `,
    ]);

    const minMax = await prisma.auditLog.aggregate({
      where,
      _min: { timestamp: true },
      _max: { timestamp: true },
    });

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
      generatedAt: new Date().toISOString(),
      filters,
    };
  }

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
    };
  }
}

export default AuditService;
