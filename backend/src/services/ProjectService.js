// src/services/ProjectService.js — v3 wave 2
//
// A Project is a specific session/instance (one real-world event) that
// ProjectSupport records can belong to. MVP scope: only TRAINING_ATTENDANCE
// projects are accepted. Other categories are reserved for future expansion.
//
// Permissions (controller enforces auth middleware, service assumes authZ
// was checked upstream):
// - create / update / delete → admin + a_admin only
// - list / findById           → any authenticated user
//
// Key invariants:
// - For TRAINING_ATTENDANCE projects, sessionDuration is immutable after
//   creation (records created via batch-attendance snapshot the duration
//   onto each ProjectSupport; changing the parent after the fact would
//   leave ledger integrity ambiguous).
// - delete is hard-delete only when no ProjectSupport references the project.
//   Otherwise we refuse — callers should unlink first.

import prisma from '../utils/prismaClient.js';
import IDGenerator from '../utils/IDGenerator.js';
import QueryUtils from '../utils/queryUtils.js';
import { serializeProject } from '../utils/serializer.js';

const PROJECT_INCLUDE = {
  department: { select: { id: true, name: true } },
  createdBy: { select: { id: true, volunteerCode: true, chineseName: true } },
  _count: { select: { projectSupports: true } },
};

const SUPPORTED_CATEGORIES = new Set(['TRAINING_ATTENDANCE']);

const writeAuditLog = async (tx, action, { project, operator, changes = [], extraDetails = {} }) => {
  await tx.auditLog.create({
    data: {
      auditId: IDGenerator.generateAuditId(),
      targetType: 'Project',
      targetId: project.id,
      action,
      actionDetails: {
        projectCode: project.projectCode,
        category: project.category,
        departmentId: project.departmentId,
        ...extraDetails,
      },
      modifiedId: project.projectCode,
      changes,
      operator: {
        id: operator?.accountId ?? null,
        volunteerId: operator?.volunteerId ?? null,
        name: operator?.name ?? null,
        role: operator?.role ?? null,
      },
      submitter: {
        id: operator?.accountId ?? null,
        volunteerId: operator?.volunteerId ?? null,
        name: operator?.name ?? null,
        role: operator?.role ?? null,
      },
    },
  });
};

const buildWhere = (filters = {}) => {
  const { category, departmentId, dateFrom, dateTo, search } = filters;
  const where = {};
  if (category) where.category = category;
  if (departmentId) where.departmentId = departmentId;
  if (dateFrom || dateTo) {
    where.sessionDate = {};
    if (dateFrom) where.sessionDate.gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      where.sessionDate.lte = end;
    }
  }
  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { projectCode: { contains: q, mode: 'insensitive' } },
    ];
  }
  return where;
};

class ProjectService {
  // ─── Read ──────────────────────────────────────────────────────────────

  static async list(filters = {}, pagination = {}, sortOptions = {}) {
    const { page = 1, limit = 20 } = pagination;
    const { sortBy = 'sessionDate', order = 'desc' } = sortOptions;
    const pg = QueryUtils.buildPaginationOptions(page, limit);
    const allowedSortFields = ['sessionDate', 'createdAt', 'updatedAt', 'name'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'sessionDate';
    const sortOrder = order?.toLowerCase() === 'asc' ? 'asc' : 'desc';

    const where = buildWhere(filters);
    const [records, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: PROJECT_INCLUDE,
        orderBy: { [sortField]: sortOrder },
        skip: pg.skip,
        take: pg.limit,
      }),
      prisma.project.count({ where }),
    ]);

    return {
      records: records.map(serializeProject),
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

  static async findById(id) {
    const row = await prisma.project.findUnique({
      where: { id },
      include: PROJECT_INCLUDE,
    });
    return row ? serializeProject(row) : null;
  }

  static async findByCode(projectCode) {
    const row = await prisma.project.findUnique({
      where: { projectCode },
      include: PROJECT_INCLUDE,
    });
    return row ? serializeProject(row) : null;
  }

  // ─── Write ─────────────────────────────────────────────────────────────

  static async create(input, operator) {
    const { name, category, departmentId, sessionDate, sessionDuration, attributes = {} } = input;

    if (!name || !category || !departmentId || !sessionDate) {
      return { validationError: 'name, category, departmentId, sessionDate 均为必填' };
    }
    if (!SUPPORTED_CATEGORIES.has(category)) {
      return { validationError: `目前只支持 category = TRAINING_ATTENDANCE（收到: ${category}）` };
    }
    const trimmedName = String(name).trim();
    if (trimmedName.length < 2 || trimmedName.length > 200) {
      return { validationError: 'name 长度必须在 2-200 之间' };
    }

    const date = new Date(sessionDate);
    if (Number.isNaN(date.getTime())) return { validationError: 'sessionDate 格式无效' };

    // For attendance projects, sessionDuration is required.
    if (category === 'TRAINING_ATTENDANCE') {
      if (typeof sessionDuration !== 'number' || sessionDuration <= 0 || sessionDuration % 0.5 !== 0) {
        return { validationError: '受训考勤项目的 sessionDuration 必须是大于 0 的 0.5 倍数' };
      }
    }

    if (!operator?.volunteerId) {
      return { forbidden: '管理员必须绑定志愿者档案才能创建项目（admin 需切到个人账号）' };
    }

    const dept = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!dept) return { validationError: `部门不存在: ${departmentId}` };

    const projectCode = await IDGenerator.generateProjectCode();

    const created = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          projectCode,
          name: trimmedName,
          category,
          departmentId,
          sessionDate: date,
          sessionDuration: sessionDuration ?? null,
          attributes: attributes && typeof attributes === 'object' ? attributes : {},
          createdById: operator.volunteerId,
        },
        include: PROJECT_INCLUDE,
      });
      await writeAuditLog(tx, 'project_create', { project, operator });
      return project;
    });

    return { project: serializeProject(created) };
  }

  static async update(id, patch, operator) {
    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) return { notFound: true };

    const data = {};
    const changes = [];
    const track = (field, from, to) => {
      if (from !== to) {
        data[field] = to;
        changes.push({ field, from, to });
      }
    };

    if (patch.name !== undefined) {
      const n = String(patch.name).trim();
      if (n.length < 2 || n.length > 200) return { validationError: 'name 长度必须在 2-200 之间' };
      track('name', existing.name, n);
    }
    if (patch.sessionDate !== undefined) {
      const d = new Date(patch.sessionDate);
      if (Number.isNaN(d.getTime())) return { validationError: 'sessionDate 格式无效' };
      if (d.toISOString() !== existing.sessionDate.toISOString()) {
        data.sessionDate = d;
        changes.push({ field: 'sessionDate', from: existing.sessionDate.toISOString(), to: d.toISOString() });
      }
    }
    if (patch.attributes !== undefined) {
      if (patch.attributes && typeof patch.attributes === 'object') {
        data.attributes = patch.attributes;
        changes.push({ field: 'attributes', from: existing.attributes, to: patch.attributes });
      }
    }
    if (patch.sessionDuration !== undefined) {
      // Attendance projects freeze duration after creation — the value was
      // snapshotted onto individual ProjectSupport rows at batch-entry time,
      // so changing the parent now would break ledger integrity.
      if (existing.category === 'TRAINING_ATTENDANCE') {
        return { validationError: '受训考勤项目创建后 sessionDuration 不可修改' };
      }
      if (typeof patch.sessionDuration !== 'number' || patch.sessionDuration <= 0 || patch.sessionDuration % 0.5 !== 0) {
        return { validationError: 'sessionDuration 必须是大于 0 的 0.5 倍数' };
      }
      track('sessionDuration', existing.sessionDuration, patch.sessionDuration);
    }

    if (changes.length === 0) {
      return { project: serializeProject({ ...existing, department: null, createdBy: null, _count: { projectSupports: 0 } }) };
    }

    const updated = await prisma.$transaction(async (tx) => {
      const project = await tx.project.update({
        where: { id },
        data,
        include: PROJECT_INCLUDE,
      });
      await writeAuditLog(tx, 'project_update', { project, operator, changes });
      return project;
    });

    return { project: serializeProject(updated) };
  }

  static async remove(id, operator) {
    const existing = await prisma.project.findUnique({
      where: { id },
      include: { _count: { select: { projectSupports: true } } },
    });
    if (!existing) return { notFound: true };
    if (existing._count.projectSupports > 0) {
      return {
        conflict: `项目下还有 ${existing._count.projectSupports} 条支援记录，请先解除关联再删除`,
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.project.delete({ where: { id } });
      await writeAuditLog(tx, 'project_delete', {
        project: existing,
        operator,
        extraDetails: { hardDelete: true },
      });
    });
    return { deleted: true };
  }
}

export default ProjectService;
