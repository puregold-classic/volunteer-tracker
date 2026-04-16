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

  // ─── Batch attendance ─────────────────────────────────────────────────
  //
  // Batch-create TRAINING_ATTENDANCE records for a list of volunteer names.
  // Matching priority: volunteerCode → chineseName → englishName (all
  // case-insensitive, only ACTIVE volunteers). Each created record inherits
  // duration from Project.sessionDuration (snapshot) so changing the parent
  // afterwards cannot silently rewrite ledger hours.
  //
  // Result shape:
  //   { total, created: [{ input, volunteer, supportId }],
  //     alreadyRecorded: [{ input, volunteer }],
  //     unmatched: [input...],
  //     ambiguous: [{ input, candidates: [volunteer...] }] }
  static async batchAttendance(projectId, { names = [], serviceItemId, description }, operator) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return { notFound: true };
    if (project.category !== 'TRAINING_ATTENDANCE') {
      return { validationError: '只有受训考勤类项目支持批量录入' };
    }
    if (!project.sessionDuration || project.sessionDuration <= 0) {
      return { validationError: '项目缺少 sessionDuration，无法批量录入' };
    }
    if (!operator?.volunteerId) {
      return { forbidden: '录入员必须绑定志愿者档案（admin 请切到个人账号）' };
    }

    if (!Array.isArray(names) || names.length === 0) {
      return { validationError: '需要提供 names 姓名列表' };
    }

    // Normalize + dedupe input. Preserve original casing for the response so
    // the UI can echo back exactly what the admin pasted.
    const seen = new Set();
    const normalizedInputs = [];
    for (const raw of names) {
      const trimmed = String(raw || '').trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      normalizedInputs.push(trimmed);
    }
    if (normalizedInputs.length === 0) {
      return { validationError: '姓名列表在去重/去空后为空' };
    }
    if (normalizedInputs.length > 500) {
      return { validationError: '单次批量录入最多 500 人，请分批处理' };
    }

    const serviceItem = await prisma.serviceItem.findUnique({ where: { id: serviceItemId } });
    if (!serviceItem || !serviceItem.isActive) {
      return { validationError: `服务项不存在或已停用: ${serviceItemId}` };
    }
    if (serviceItem.category !== 'TRAINING_ATTENDANCE') {
      return { validationError: '服务项必须是受训考勤类（TRAINING_ATTENDANCE）' };
    }
    if (serviceItem.departmentId !== project.departmentId) {
      return { validationError: '服务项不属于项目所在部门，请选择本部门的「受训」服务项' };
    }

    const desc = (description && String(description).trim()) || `参加 ${project.name}`;
    if (desc.length < 5 || desc.length > 1000) {
      return { validationError: 'description 长度必须在 5-1000 之间（或留空使用默认）' };
    }

    // Single scan of the active volunteer library — attendance lists are
    // small enough that the memory cost is negligible vs per-name queries.
    const allActive = await prisma.volunteer.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, volunteerCode: true, chineseName: true, englishName: true },
    });
    const byCode = new Map();
    const byCn = new Map();
    const byEn = new Map();
    for (const v of allActive) {
      byCode.set(v.volunteerCode.toLowerCase(), v);
      const cn = v.chineseName?.toLowerCase();
      if (cn) {
        if (!byCn.has(cn)) byCn.set(cn, []);
        byCn.get(cn).push(v);
      }
      const en = v.englishName?.toLowerCase();
      if (en) {
        if (!byEn.has(en)) byEn.set(en, []);
        byEn.get(en).push(v);
      }
    }

    const matches = [];
    const ambiguous = [];
    const unmatched = [];
    for (const input of normalizedInputs) {
      const lower = input.toLowerCase();
      const codeHit = byCode.get(lower);
      if (codeHit) { matches.push({ input, volunteer: codeHit }); continue; }
      const cnHits = byCn.get(lower);
      if (cnHits?.length === 1) { matches.push({ input, volunteer: cnHits[0] }); continue; }
      if (cnHits?.length > 1) { ambiguous.push({ input, candidates: cnHits }); continue; }
      const enHits = byEn.get(lower);
      if (enHits?.length === 1) { matches.push({ input, volunteer: enHits[0] }); continue; }
      if (enHits?.length > 1) { ambiguous.push({ input, candidates: enHits }); continue; }
      unmatched.push(input);
    }

    // Skip volunteers who already have an ACTIVE PS for this project — lets
    // admins re-paste the same list without creating duplicates.
    const matchedIds = matches.map((m) => m.volunteer.id);
    const existingRows = matchedIds.length
      ? await prisma.projectSupport.findMany({
          where: {
            projectId: project.id,
            status: 'ACTIVE',
            volunteerId: { in: matchedIds },
          },
          select: { volunteerId: true },
        })
      : [];
    const alreadyIds = new Set(existingRows.map((r) => r.volunteerId));

    // Dedupe by matched volunteer. Two inputs like "王一" and "PG-0010" that
    // resolve to the same person should produce a single record — first
    // input wins and is the one reported back in the response.
    const seenVolunteerIds = new Set();
    const alreadyRecorded = [];
    const toCreate = [];
    for (const m of matches) {
      if (seenVolunteerIds.has(m.volunteer.id)) continue;
      seenVolunteerIds.add(m.volunteer.id);
      if (alreadyIds.has(m.volunteer.id)) {
        alreadyRecorded.push(m);
      } else {
        toCreate.push(m);
      }
    }

    const created = [];
    await prisma.$transaction(async (tx) => {
      for (const m of toCreate) {
        const supportId = await IDGenerator.generateSupportId(m.volunteer.volunteerCode);
        try {
          const rec = await tx.projectSupport.create({
            data: {
              supportId,
              volunteerId: m.volunteer.id,
              submittedById: operator.volunteerId,
              serviceItemId: serviceItem.id,
              projectId: project.id,
              serviceDate: project.sessionDate,
              duration: project.sessionDuration,
              description: desc,
              status: 'ACTIVE',
              confirmedAt: new Date(),
            },
            select: { id: true, supportId: true },
          });
          created.push({
            input: m.input,
            volunteer: {
              id: m.volunteer.id,
              volunteerCode: m.volunteer.volunteerCode,
              chineseName: m.volunteer.chineseName,
            },
            supportId: rec.supportId,
          });
        } catch (err) {
          // The pre-check (projectId + ACTIVE) covers the common dedup case;
          // the partial unique index can still fire if an identical row
          // already exists from individual submission. Treat it as "already
          // recorded" rather than failing the whole batch.
          if (err.code === 'P2002') {
            alreadyRecorded.push(m);
            continue;
          }
          throw err;
        }
      }
      await tx.auditLog.create({
        data: {
          auditId: IDGenerator.generateAuditId(),
          targetType: 'Project',
          targetId: project.id,
          action: 'project_attendance_batch',
          actionDetails: {
            projectCode: project.projectCode,
            serviceItemId: serviceItem.id,
            serviceItemName: serviceItem.name,
            totalInput: normalizedInputs.length,
            created: created.length,
            alreadyRecorded: alreadyRecorded.length,
            unmatched: unmatched.length,
            ambiguous: ambiguous.length,
          },
          modifiedId: project.projectCode,
          changes: [],
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
    });

    // Pretty-shape for the response: strip internal volunteer fields the UI
    // doesn't need, keep what the admin can act on.
    const slim = (v) => ({
      id: v.id,
      volunteerCode: v.volunteerCode,
      chineseName: v.chineseName,
    });
    return {
      total: normalizedInputs.length,
      created,
      alreadyRecorded: alreadyRecorded.map((m) => ({ input: m.input, volunteer: slim(m.volunteer) })),
      unmatched,
      ambiguous: ambiguous.map((m) => ({ input: m.input, candidates: m.candidates.map(slim) })),
    };
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
