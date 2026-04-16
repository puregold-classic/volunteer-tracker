// src/services/ProjectSupportService.js — v2.1
//
// The heart of the simplified flow:
// - Self-submit goes straight to ACTIVE.
// - Proxy submit (A submits for B) creates PENDING_CONFIRMATION; B confirms or
//   rejects from their dashboard.
// - Owner can freely create/update/delete their own records.
// - Admin can override anyone's records (subject to month-lock).
// - Month-lock: records with serviceDate < SystemSettings.lockedBefore are
//   immutable to non-admin users.
// - Dedup: a partial unique index on (volunteerId, serviceDate, serviceItemId,
//   duration, description) WHERE status='ACTIVE' rejects exact duplicates at
//   the DB level. Surface a friendly error.
// - All mutations write to AuditLog.
//
// Replaces v1's ServiceService (read side) and ReviewService (write via
// approval). The "review" pipeline is gone — submission is direct.

import prisma from '../utils/prismaClient.js';
import IDGenerator from '../utils/IDGenerator.js';
import QueryUtils from '../utils/queryUtils.js';
import SystemSettingsService from './SystemSettingsService.js';
import { serializeProjectSupport } from '../utils/serializer.js';

const SUPPORT_INCLUDE = {
  volunteer: { select: { id: true, volunteerCode: true, chineseName: true, departmentId: true } },
  submittedBy: { select: { id: true, volunteerCode: true, chineseName: true } },
  serviceItem: {
    select: {
      id: true, name: true, departmentId: true,
      department: { select: { id: true, name: true } },
    },
  },
};

// ─── Auth helpers ─────────────────────────────────────────────────────────────

const isAdmin = (operator) => operator?.role === 'admin' || operator?.role === 'a_admin';

const requireOwnerOrAdmin = (record, operator) => {
  if (isAdmin(operator)) return null;
  if (record.volunteerId === operator?.volunteerId) return null;
  return { forbidden: '只有本人或管理员可以操作此记录' };
};

const checkLock = async (serviceDate, operator) => {
  if (isAdmin(operator)) return null;
  const locked = await SystemSettingsService.isDateLocked(serviceDate);
  if (locked) return { locked: '该日期所在的统计周期已封档，无法变更' };
  return null;
};

const writeAuditLog = async (tx, action, {
  record, operator, changes = [], submitter = null, extraDetails = {},
}) => {
  await tx.auditLog.create({
    data: {
      auditId: IDGenerator.generateAuditId(),
      targetType: 'ProjectSupport',
      targetId: record.id,
      action,
      actionDetails: {
        supportId: record.supportId,
        status: record.status,
        volunteerId: record.volunteerId,
        ...extraDetails,
      },
      modifiedId: record.supportId,
      changes,
      operator: {
        id: operator?.accountId ?? null,
        volunteerId: operator?.volunteerId ?? null,
        name: operator?.name ?? null,
        role: operator?.role ?? null,
      },
      submitter: submitter || {
        id: operator?.accountId ?? null,
        volunteerId: operator?.volunteerId ?? null,
        name: operator?.name ?? null,
        role: operator?.role ?? null,
      },
    },
  });
};

// ─── Read ─────────────────────────────────────────────────────────────────────

const buildSupportWhere = (filters = {}) => {
  const {
    volunteerId,
    submittedById,
    serviceItemId,
    departmentId,
    status,
    serviceDateFrom,
    serviceDateTo,
    minDuration,
    maxDuration,
    isProxy,
    search,
  } = filters;

  const where = {};

  // Default: only ACTIVE; explicit status filter overrides.
  if (status) {
    if (Array.isArray(status)) where.status = { in: status };
    else where.status = status;
  } else {
    where.status = 'ACTIVE';
  }

  if (volunteerId) where.volunteerId = volunteerId;
  if (submittedById) where.submittedById = submittedById;
  if (serviceItemId) where.serviceItemId = serviceItemId;
  if (departmentId) {
    where.serviceItem = { departmentId };
  }

  if (serviceDateFrom || serviceDateTo) {
    where.serviceDate = {};
    if (serviceDateFrom) where.serviceDate.gte = new Date(serviceDateFrom);
    if (serviceDateTo) {
      const end = new Date(serviceDateTo);
      end.setHours(23, 59, 59, 999);
      where.serviceDate.lte = end;
    }
  }

  if (minDuration || maxDuration) {
    where.duration = {};
    if (minDuration) where.duration.gte = parseFloat(minDuration);
    if (maxDuration) where.duration.lte = parseFloat(maxDuration);
  }

  if (isProxy === true || isProxy === 'true') {
    where.NOT = { volunteerId: { equals: prisma.projectSupport.fields?.submittedById } };
    // Prisma can't reference column-to-column directly in WHERE; the cleanest
    // trick is to fetch and filter post-hoc, OR use $queryRaw. For now we
    // accept the false positive: callers using isProxy should use the ledger
    // analytics path which uses raw SQL.
    delete where.NOT;
  }

  if (search && search.trim()) {
    where.OR = [
      { description: { contains: search.trim(), mode: 'insensitive' } },
      { volunteer: { chineseName: { contains: search.trim(), mode: 'insensitive' } } },
      { volunteer: { volunteerCode: { contains: search.trim(), mode: 'insensitive' } } },
    ];
  }

  return where;
};

class ProjectSupportService {
  // ─── Read methods ───────────────────────────────────────────────────────

  /** Paginated list. Default: only ACTIVE records. */
  static async list(filters = {}, pagination = {}, sortOptions = {}) {
    const { page = 1, limit = 20 } = pagination;
    const { sortBy = 'serviceDate', order = 'desc' } = sortOptions;
    const pg = QueryUtils.buildPaginationOptions(page, limit);

    const allowedSortFields = ['serviceDate', 'createdAt', 'updatedAt', 'duration', 'status'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'serviceDate';
    const sortOrder = order.toLowerCase() === 'asc' ? 'asc' : 'desc';

    const where = buildSupportWhere(filters);

    const [records, total] = await Promise.all([
      prisma.projectSupport.findMany({
        where,
        include: SUPPORT_INCLUDE,
        orderBy: { [sortField]: sortOrder },
        skip: pg.skip,
        take: pg.limit,
      }),
      prisma.projectSupport.count({ where }),
    ]);

    return {
      records: records.map(serializeProjectSupport),
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

  static async findBySupportId(supportId) {
    const record = await prisma.projectSupport.findUnique({
      where: { supportId },
      include: SUPPORT_INCLUDE,
    });
    if (!record) throw new Error(`项目支援记录不存在: ${supportId}`);
    return serializeProjectSupport(record);
  }

  /** Records owned by a volunteer (across all statuses, optionally filtered). */
  static async listByOwner(volunteerId, filters = {}, pagination = {}) {
    return this.list({ ...filters, volunteerId }, pagination);
  }

  /** Records pending the volunteer's confirmation (someone proxy-submitted for them). */
  static async listPendingForOwner(volunteerId) {
    const records = await prisma.projectSupport.findMany({
      where: { volunteerId, status: 'PENDING_CONFIRMATION' },
      include: SUPPORT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return records.map(serializeProjectSupport);
  }

  // ─── Write methods ──────────────────────────────────────────────────────

  /**
   * Create a new ProjectSupport record. The operator decides who they're
   * submitting for via input.volunteerId. If that differs from operator's
   * own volunteerId, the record starts as PENDING_CONFIRMATION; otherwise
   * ACTIVE.
   *
   * @param {object} input - {volunteerId, serviceItemId, serviceDate, duration, description}
   * @param {object} operator - req.user (must have volunteerId; admin can override anything)
   */
  static async create(input, operator) {
    const { volunteerId, serviceItemId, serviceDate, duration, description } = input;

    if (!volunteerId || !serviceItemId || !serviceDate || duration == null || !description) {
      return { validationError: 'volunteerId, serviceItemId, serviceDate, duration, description 均为必填' };
    }
    if (typeof duration !== 'number' || duration <= 0 || duration % 0.5 !== 0) {
      return { validationError: 'duration 必须是大于 0 的 0.5 倍数' };
    }
    if (String(description).trim().length < 5 || String(description).trim().length > 1000) {
      return { validationError: 'description 必须是 5-1000 字符' };
    }
    const date = new Date(serviceDate);
    if (Number.isNaN(date.getTime())) return { validationError: 'serviceDate 格式无效' };
    if (date > new Date()) return { validationError: 'serviceDate 不能是未来日期' };

    // Operator must be a real volunteer (admin can also use this endpoint; admin
    // submitting for someone else is treated as proxy).
    if (!operator?.volunteerId && !isAdmin(operator)) {
      return { forbidden: '只有志愿者或管理员可以提交项目支援记录' };
    }

    // Lock check (skipped for admin)
    const lockErr = await checkLock(date, operator);
    if (lockErr) return lockErr;

    // Validate target volunteer + service item exist
    const [owner, item] = await Promise.all([
      prisma.volunteer.findUnique({ where: { id: volunteerId } }),
      prisma.serviceItem.findUnique({ where: { id: serviceItemId } }),
    ]);
    if (!owner) return { validationError: `志愿者不存在: ${volunteerId}` };
    if (!item || !item.isActive) return { validationError: `服务项不存在或已停用: ${serviceItemId}` };
    // 受训考勤只能通过项目级批量录入进入系统（wave 2 的 batch-entry 路径）。
    // 走个人提交通道会违背"受训是考勤、由组织方统一录入"的产品语义。
    if (item.category === 'TRAINING_ATTENDANCE') {
      return { validationError: '受训类服务项仅支持项目级批量录入，不能个人提交' };
    }

    // Determine status:
    //   - self-submit → ACTIVE
    //   - privileged proxy (admin / a_admin / b_admin 代别人提交) → ACTIVE 直接生效；
    //     v3 产品决策：a/b-admin 相当于录入员，免对方 confirm
    //   - 普通志愿者代他人提交 → PENDING_CONFIRMATION，等 owner confirm
    //   - input.forceActive 保留为 admin 专用旁路开关（admin UI 里的"直接生效"选项）
    const isSelfSubmit = operator.volunteerId === volunteerId;
    const isPrivilegedProxy = !isSelfSubmit && (
      operator.role === 'admin' ||
      operator.role === 'a_admin' ||
      operator.role === 'b_admin'
    );
    const forcedByAdmin = !isSelfSubmit && isAdmin(operator) && input.forceActive;
    const status = (isSelfSubmit || isPrivilegedProxy || forcedByAdmin)
      ? 'ACTIVE'
      : 'PENDING_CONFIRMATION';
    const submittedById = operator.volunteerId || volunteerId; // admin without volunteer self-attributes

    const supportId = await IDGenerator.generateSupportId(owner.volunteerCode);

    try {
      const created = await prisma.$transaction(async (tx) => {
        const record = await tx.projectSupport.create({
          data: {
            supportId,
            volunteerId,
            submittedById,
            serviceItemId,
            serviceDate: date,
            duration,
            description: String(description).trim(),
            status,
            confirmedAt: status === 'ACTIVE' ? new Date() : null,
          },
          include: SUPPORT_INCLUDE,
        });
        await writeAuditLog(tx, 'support_create', {
          record,
          operator,
          extraDetails: isPrivilegedProxy ? { proxyBypassedConfirm: true } : undefined,
        });
        return record;
      });
      return { record: serializeProjectSupport(created) };
    } catch (err) {
      if (err.code === 'P2002' || /project_supports_active_dedup/.test(err.message)) {
        return { duplicate: '已存在完全相同的支援记录（同一志愿者、日期、服务项、时长、描述）' };
      }
      throw err;
    }
  }

  /**
   * Update an existing ProjectSupport. Owner can edit own; admin can edit any.
   * Subject to month-lock for non-admin.
   */
  static async update(supportId, patch, operator) {
    const existing = await prisma.projectSupport.findUnique({
      where: { supportId },
      include: { volunteer: true, serviceItem: true },
    });
    if (!existing) return { notFound: true };
    if (existing.status === 'DELETED') return { notFound: true };

    const ownerCheck = requireOwnerOrAdmin(existing, operator);
    if (ownerCheck) return ownerCheck;

    // Lock check uses the OLD serviceDate (cannot edit a locked record at all)
    const lockErr = await checkLock(existing.serviceDate, operator);
    if (lockErr) return lockErr;

    const data = {};
    const changes = [];
    const trackChange = (field, from, to) => {
      if (from !== to) {
        data[field] = to;
        changes.push({ field, from, to });
      }
    };

    if (patch.serviceItemId !== undefined) {
      const item = await prisma.serviceItem.findUnique({ where: { id: patch.serviceItemId } });
      if (!item || !item.isActive) return { validationError: `服务项不存在或已停用: ${patch.serviceItemId}` };
      trackChange('serviceItemId', existing.serviceItemId, patch.serviceItemId);
    }
    if (patch.serviceDate !== undefined) {
      const newDate = new Date(patch.serviceDate);
      if (Number.isNaN(newDate.getTime())) return { validationError: 'serviceDate 格式无效' };
      if (newDate > new Date()) return { validationError: 'serviceDate 不能是未来日期' };
      // If moving to a locked date, also reject
      const newLockErr = await checkLock(newDate, operator);
      if (newLockErr) return newLockErr;
      trackChange('serviceDate', existing.serviceDate.toISOString(), newDate.toISOString());
      data.serviceDate = newDate;
    }
    if (patch.duration !== undefined) {
      if (typeof patch.duration !== 'number' || patch.duration <= 0 || patch.duration % 0.5 !== 0) {
        return { validationError: 'duration 必须是大于 0 的 0.5 倍数' };
      }
      trackChange('duration', existing.duration, patch.duration);
    }
    if (patch.description !== undefined) {
      const desc = String(patch.description).trim();
      if (desc.length < 5 || desc.length > 1000) {
        return { validationError: 'description 必须是 5-1000 字符' };
      }
      trackChange('description', existing.description, desc);
      data.description = desc;
    }

    if (changes.length === 0) {
      return { record: serializeProjectSupport(existing) };
    }

    try {
      const updated = await prisma.$transaction(async (tx) => {
        const record = await tx.projectSupport.update({
          where: { supportId },
          data,
          include: SUPPORT_INCLUDE,
        });
        await writeAuditLog(tx, 'support_update', { record, operator, changes });
        return record;
      });
      return { record: serializeProjectSupport(updated) };
    } catch (err) {
      if (err.code === 'P2002' || /project_supports_active_dedup/.test(err.message)) {
        return { duplicate: '修改后会与已有记录重复' };
      }
      throw err;
    }
  }

  /**
   * Soft-delete: status → DELETED. Owner or admin only. Subject to lock.
   */
  static async remove(supportId, operator) {
    const existing = await prisma.projectSupport.findUnique({
      where: { supportId },
      include: { volunteer: true },
    });
    if (!existing) return { notFound: true };
    if (existing.status === 'DELETED') return { record: serializeProjectSupport(existing) };

    const ownerCheck = requireOwnerOrAdmin(existing, operator);
    if (ownerCheck) return ownerCheck;

    const lockErr = await checkLock(existing.serviceDate, operator);
    if (lockErr) return lockErr;

    const deleted = await prisma.$transaction(async (tx) => {
      const record = await tx.projectSupport.update({
        where: { supportId },
        data: { status: 'DELETED' },
        include: SUPPORT_INCLUDE,
      });
      await writeAuditLog(tx, 'support_delete', { record, operator });
      return record;
    });
    return { record: serializeProjectSupport(deleted) };
  }

  /**
   * Owner confirms a proxy submission. Status PENDING_CONFIRMATION → ACTIVE.
   * Only the owner can confirm; admin override is also allowed.
   */
  static async confirm(supportId, operator) {
    const existing = await prisma.projectSupport.findUnique({
      where: { supportId },
      include: SUPPORT_INCLUDE,
    });
    if (!existing) return { notFound: true };
    if (existing.status !== 'PENDING_CONFIRMATION') {
      return { invalidStatus: `当前状态 ${existing.status}，无法确认` };
    }

    const isOwner = existing.volunteerId === operator?.volunteerId;
    if (!isOwner && !isAdmin(operator)) {
      return { forbidden: '只有本人可以确认此记录（管理员可代为确认）' };
    }

    try {
      const updated = await prisma.$transaction(async (tx) => {
        const record = await tx.projectSupport.update({
          where: { supportId },
          data: { status: 'ACTIVE', confirmedAt: new Date() },
          include: SUPPORT_INCLUDE,
        });
        const submitter = {
          id: existing.submittedById,
          name: existing.submittedBy?.chineseName ?? null,
        };
        await writeAuditLog(tx, 'support_confirm', { record, operator, submitter });
        return record;
      });
      return { record: serializeProjectSupport(updated) };
    } catch (err) {
      if (err.code === 'P2002' || /project_supports_active_dedup/.test(err.message)) {
        return { duplicate: '确认后会与已有 ACTIVE 记录重复，请联系提交人或管理员处理' };
      }
      throw err;
    }
  }

  /**
   * Owner rejects a proxy submission. Status PENDING_CONFIRMATION → REJECTED_BY_OWNER.
   * The row is preserved for audit; not counted toward stats.
   */
  static async reject(supportId, operator, { reason = '' } = {}) {
    const existing = await prisma.projectSupport.findUnique({
      where: { supportId },
      include: SUPPORT_INCLUDE,
    });
    if (!existing) return { notFound: true };
    if (existing.status !== 'PENDING_CONFIRMATION') {
      return { invalidStatus: `当前状态 ${existing.status}，无法拒绝` };
    }

    const isOwner = existing.volunteerId === operator?.volunteerId;
    if (!isOwner && !isAdmin(operator)) {
      return { forbidden: '只有本人可以拒绝此记录（管理员可代为拒绝）' };
    }

    const updated = await prisma.$transaction(async (tx) => {
      const record = await tx.projectSupport.update({
        where: { supportId },
        data: { status: 'REJECTED_BY_OWNER' },
        include: SUPPORT_INCLUDE,
      });
      await writeAuditLog(tx, 'support_reject', {
        record,
        operator,
        changes: reason ? [{ field: 'reason', from: null, to: reason }] : [],
      });
      return record;
    });
    return { record: serializeProjectSupport(updated) };
  }
}

export default ProjectSupportService;
