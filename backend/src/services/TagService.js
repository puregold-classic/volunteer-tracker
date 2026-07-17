// src/services/TagService.js — v3.2
//
// Tag = individual label value under a TagGroup. Attach/detach live here too
// (1-at-a-time); batch ops on a tag (create/update/delete/attach/detach many)
// also live here as they're fundamentally "tag-scoped bulk actions".
//
// Permission enforcement in this layer:
//   - Tag CRUD = a_admin+ (or creator of group when openness=open for attach)
//   - Attach on open group by any authenticated user (subject to own-PS rule)
//   - Batch ops on managed groups = a_admin+
//   - Detach: caller must be owner of PS OR a_admin+

import prisma from '../utils/prismaClient.js';
import IDGenerator from '../utils/IDGenerator.js';
import { serializeProjectSupport } from '../utils/serializer.js';

const isPrivileged = (op) => op?.role === 'admin' || op?.role === 'a_admin';
const isBAdminOrAbove = (op) => isPrivileged(op) || op?.role === 'b_admin';

const TAG_INCLUDE = {
  group: true,
  createdBy: { select: { id: true, volunteerCode: true, chineseName: true } },
};

const serializeOperator = (op) => ({
  id: op?.accountId ?? null,
  volunteerId: op?.volunteerId ?? null,
  name: op?.name ?? null,
  role: op?.role ?? null,
});

const writeAudit = async (tx, action, {
  tagId, supportId, operator, extraDetails = {}, changes = [],
}) => {
  await tx.auditLog.create({
    data: {
      auditId: IDGenerator.generateAuditId(),
      targetType: 'Tag',
      targetId: tagId ?? supportId,
      action,
      actionDetails: { tagId, supportId, ...extraDetails },
      modifiedId: supportId ?? tagId,
      changes,
      operator: serializeOperator(operator),
      submitter: serializeOperator(operator),
    },
  });
};

class TagService {
  // ─── Tag CRUD ─────────────────────────────────────────────────────────

  static async listByGroup(groupId) {
    const rows = await prisma.tag.findMany({
      where: { groupId },
      include: TAG_INCLUDE,
      orderBy: { name: 'asc' },
    });
    return rows;
  }

  static async findById(id) {
    return prisma.tag.findUnique({ where: { id }, include: TAG_INCLUDE });
  }

  static async create({ groupId, name }, operator) {
    if (!groupId || !name || !String(name).trim()) {
      return { validationError: 'groupId + name 必填' };
    }
    const group = await prisma.tagGroup.findUnique({ where: { id: groupId } });
    if (!group) return { validationError: `标签组不存在: ${groupId}` };

    // closed group: only a_admin+ can add tags. open group: any authed volunteer.
    if (group.openness === 'closed' && !isPrivileged(operator)) {
      return { forbidden: '该组为 closed，只有 a_admin+ 可以添加 tag' };
    }
    // v3.7: pure system admin (volunteerId=null) may create tags — createdById is
    // now optional audit provenance, so no volunteer identity is required.

    try {
      const created = await prisma.$transaction(async (tx) => {
        const tag = await tx.tag.create({
          data: {
            groupId,
            name: String(name).trim(),
            createdById: operator.volunteerId ?? null,
          },
          include: TAG_INCLUDE,
        });
        await writeAudit(tx, 'tag_create', {
          tagId: tag.id, operator, extraDetails: { groupId, groupName: group.name, name: tag.name },
        });
        return tag;
      });
      return { tag: created };
    } catch (err) {
      if (err.code === 'P2002') return { conflict: '该组内已存在同名 tag' };
      throw err;
    }
  }

  static async update(id, patch, operator) {
    const existing = await prisma.tag.findUnique({ where: { id } });
    if (!existing) return { notFound: true };
    if (!isPrivileged(operator)) return { forbidden: '修改 tag 需要 a_admin+' };

    const data = {};
    const changes = [];
    if (patch.name !== undefined) {
      const newName = String(patch.name).trim();
      if (newName && newName !== existing.name) {
        data.name = newName;
        changes.push({ field: 'name', from: existing.name, to: newName });
      }
    }
    if (changes.length === 0) return { tag: await this.findById(id) };

    try {
      const updated = await prisma.$transaction(async (tx) => {
        const tag = await tx.tag.update({ where: { id }, data, include: TAG_INCLUDE });
        await writeAudit(tx, 'tag_update', { tagId: id, operator, changes });
        return tag;
      });
      return { tag: updated };
    } catch (err) {
      if (err.code === 'P2002') return { conflict: '同组内已存在同名 tag' };
      throw err;
    }
  }

  static async remove(id, operator) {
    const existing = await prisma.tag.findUnique({
      where: { id },
      include: { _count: { select: { attachments: true } } },
    });
    if (!existing) return { notFound: true };
    if (!isPrivileged(operator)) return { forbidden: '删除 tag 需要 a_admin+' };

    await prisma.$transaction(async (tx) => {
      await tx.tag.delete({ where: { id } });
      await writeAudit(tx, 'tag_delete', {
        tagId: id, operator,
        extraDetails: { name: existing.name, attachmentCount: existing._count.attachments },
      });
    });
    return { deleted: true, attachmentCount: existing._count.attachments };
  }

  // ─── Attach / detach (single) ─────────────────────────────────────────

  /**
   * Attach a tag to a ProjectSupport. Enforces:
   *  - support exists + ACTIVE
   *  - if group.boundServiceItemIds is non-empty, support.serviceItemId must be in list
   *  - if group.selectionMode='single', detach any existing tag from same group first
   *  - caller permission: owner of PS or a_admin+/b_admin (録入員)
   */
  static async attach(tagId, supportId, operator) {
    const tag = await prisma.tag.findUnique({ where: { id: tagId }, include: { group: true } });
    if (!tag) return { validationError: `tag 不存在: ${tagId}` };

    const support = await prisma.projectSupport.findUnique({
      where: { id: supportId },
      include: { serviceItem: true },
    });
    if (!support) return { validationError: `服务记录不存在: ${supportId}` };
    if (support.status !== 'ACTIVE') {
      return { validationError: `仅能给 ACTIVE 服务记录贴标签，当前状态 ${support.status}` };
    }

    // permission: owner OR a_admin/b_admin+
    const isOwner = operator?.volunteerId === support.volunteerId;
    if (!isOwner && !isBAdminOrAbove(operator)) {
      return { forbidden: '只有本人或 b_admin+ 可以贴标签' };
    }

    // boundServiceItems check
    if (tag.group.boundServiceItemIds.length > 0 &&
        !tag.group.boundServiceItemIds.includes(support.serviceItemId)) {
      return {
        validationError: `标签组 "${tag.group.name}" 限定于特定 service item，不适用于当前服务`,
      };
    }

    const result = await prisma.$transaction(async (tx) => {
      let detachedCount = 0;
      // single selection: remove any existing tag from same group on this support
      if (tag.group.selectionMode === 'single') {
        const toDetach = await tx.tagAttachment.findMany({
          where: {
            supportId,
            tag: { groupId: tag.groupId },
            NOT: { tagId },
          },
          select: { id: true, tagId: true },
        });
        if (toDetach.length > 0) {
          await tx.tagAttachment.deleteMany({
            where: { id: { in: toDetach.map((t) => t.id) } },
          });
          detachedCount = toDetach.length;
        }
      }

      // idempotent attach: no-op if already attached
      const existingLink = await tx.tagAttachment.findUnique({
        where: { tagId_supportId: { tagId, supportId } },
      });
      if (existingLink) {
        return { attachment: existingLink, alreadyAttached: true, detachedCount };
      }
      const attachment = await tx.tagAttachment.create({
        data: {
          tagId,
          supportId,
          attachedById: operator.volunteerId || support.volunteerId,
        },
      });
      await writeAudit(tx, 'tag_attach', {
        tagId, supportId, operator,
        extraDetails: { tagName: tag.name, groupName: tag.group.name, detachedCount },
      });
      return { attachment, alreadyAttached: false, detachedCount };
    });

    return result;
  }

  static async detach(tagId, supportId, operator) {
    const support = await prisma.projectSupport.findUnique({ where: { id: supportId } });
    if (!support) return { validationError: `服务记录不存在: ${supportId}` };

    const isOwner = operator?.volunteerId === support.volunteerId;
    if (!isOwner && !isBAdminOrAbove(operator)) {
      return { forbidden: '只有本人或 b_admin+ 可以解除关联' };
    }

    const existing = await prisma.tagAttachment.findUnique({
      where: { tagId_supportId: { tagId, supportId } },
    });
    if (!existing) return { removed: false };

    await prisma.$transaction(async (tx) => {
      await tx.tagAttachment.delete({ where: { id: existing.id } });
      await writeAudit(tx, 'tag_detach', { tagId, supportId, operator });
    });
    return { removed: true };
  }

  // ─── Tag member listing ───────────────────────────────────────────────

  /**
   * ProjectSupport rows currently attached to this tag, with related data.
   * Only ACTIVE supports are returned: a soft-delete (status=DELETED, e.g. via
   * batchDelete) leaves the TagAttachment row intact, so without this filter
   * the member would keep showing here even after being deleted. Filtering on
   * status keeps the attachment recoverable (restoring the PS re-surfaces it).
   */
  static async listSupports(tagId, { limit = 100 } = {}) {
    const attachments = await prisma.tagAttachment.findMany({
      where: { tagId, support: { status: 'ACTIVE' } },
      take: Math.min(limit, 500),
      orderBy: { attachedAt: 'desc' },
      include: {
        support: {
          include: {
            volunteer: { select: { id: true, volunteerCode: true, chineseName: true, departmentId: true } },
            submittedBy: { select: { id: true, volunteerCode: true, chineseName: true } },
            serviceItem: {
              select: { id: true, name: true, departmentId: true, department: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });
    return attachments.map((a) => ({
      attachedAt: a.attachedAt,
      attachedById: a.attachedById,
      // Use the shared serializer so the shape matches everywhere else
      // (flattens serviceItem.department.name → serviceItem.departmentName).
      support: serializeProjectSupport(a.support),
    }));
  }

  // ─── Batch ops (managed groups only) ──────────────────────────────────

  /**
   * Bulk-create ProjectSupport rows + auto-attach this tag + optionally also
   * attach additionalTagIds. Reuses the name-matching / dedup pattern from
   * the old ProjectService.batchAttendance, generalized to any tag.
   *
   * Requires tag.group.opMode === 'managed'. Only a_admin+ can invoke.
   *
   * payload: { names[], serviceItemId, serviceDate, duration, description?, additionalTagIds? }
   */
  static async batchCreate(tagId, payload, operator) {
    const tag = await prisma.tag.findUnique({ where: { id: tagId }, include: { group: true } });
    if (!tag) return { notFound: true };
    if (tag.group.opMode !== 'managed') {
      return { forbidden: `标签组 "${tag.group.name}" 不是 managed 模式，不能批量创建` };
    }
    if (!isPrivileged(operator)) return { forbidden: '批量创建需要 a_admin+' };
    if (!operator?.volunteerId) {
      return { forbidden: '操作员必须绑定 volunteer 档案' };
    }

    const {
      names = [], serviceItemId, serviceDate, duration,
      description, additionalTagIds = [],
    } = payload;

    if (!Array.isArray(names) || names.length === 0) return { validationError: '名单不能为空' };
    if (names.length > 500) return { validationError: '单次最多 500 人' };
    if (!serviceItemId) return { validationError: 'serviceItemId 必填' };
    if (!serviceDate) return { validationError: 'serviceDate 必填' };
    if (typeof duration !== 'number' || duration <= 0 || duration % 0.5 !== 0) {
      return { validationError: 'duration 必须是大于 0 的 0.5 倍数' };
    }

    const serviceItem = await prisma.serviceItem.findUnique({ where: { id: serviceItemId } });
    if (!serviceItem || !serviceItem.isActive) {
      return { validationError: `服务项不存在或已停用: ${serviceItemId}` };
    }

    const date = new Date(serviceDate);
    if (Number.isNaN(date.getTime())) return { validationError: 'serviceDate 格式无效' };

    const desc = (description && String(description).trim()) || `参加 ${tag.name}`;
    if (desc.length < 5 || desc.length > 1000) {
      return { validationError: 'description 长度 5-1000（或留空自动填）' };
    }

    // Validate additionalTagIds exist
    if (additionalTagIds.length > 0) {
      const count = await prisma.tag.count({ where: { id: { in: additionalTagIds } } });
      if (count !== additionalTagIds.length) return { validationError: '部分 additionalTagIds 不存在' };
    }

    // Normalize + dedupe input names
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
    if (normalizedInputs.length === 0) return { validationError: '去重/去空后名单为空' };

    // Name matching against ACTIVE volunteers (code > chineseName > englishName, case-insensitive)
    const allActive = await prisma.volunteer.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, volunteerCode: true, chineseName: true, englishName: true },
    });
    const byCode = new Map(), byCn = new Map(), byEn = new Map();
    for (const v of allActive) {
      byCode.set(v.volunteerCode.toLowerCase(), v);
      const cn = v.chineseName?.toLowerCase();
      if (cn) { if (!byCn.has(cn)) byCn.set(cn, []); byCn.get(cn).push(v); }
      const en = v.englishName?.toLowerCase();
      if (en) { if (!byEn.has(en)) byEn.set(en, []); byEn.get(en).push(v); }
    }
    const matches = [], ambiguous = [], unmatched = [];
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

    // Skip volunteers already attached to this tag (idempotency)
    const matchedIds = matches.map((m) => m.volunteer.id);
    const existingAttaches = matchedIds.length
      ? await prisma.tagAttachment.findMany({
          where: {
            tagId,
            support: { volunteerId: { in: matchedIds }, status: 'ACTIVE' },
          },
          include: { support: { select: { volunteerId: true } } },
        })
      : [];
    const alreadyAttachedVolIds = new Set(existingAttaches.map((a) => a.support.volunteerId));

    // Collapse multiple input variants matching same volunteer to one create
    const seenVolIds = new Set();
    const alreadyRecorded = [];
    const toCreate = [];
    for (const m of matches) {
      if (seenVolIds.has(m.volunteer.id)) continue;
      seenVolIds.add(m.volunteer.id);
      if (alreadyAttachedVolIds.has(m.volunteer.id)) {
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
              serviceItemId,
              serviceDate: date,
              duration,
              description: desc,
              status: 'ACTIVE',
              confirmedAt: new Date(),
            },
            select: { id: true, supportId: true },
          });
          // Attach primary tag
          await tx.tagAttachment.create({
            data: { tagId, supportId: rec.id, attachedById: operator.volunteerId },
          });
          // Attach additional tags
          for (const extraTagId of additionalTagIds) {
            await tx.tagAttachment.create({
              data: { tagId: extraTagId, supportId: rec.id, attachedById: operator.volunteerId },
            });
          }
          created.push({
            input: m.input,
            volunteer: { id: m.volunteer.id, volunteerCode: m.volunteer.volunteerCode, chineseName: m.volunteer.chineseName },
            supportId: rec.supportId,
          });
        } catch (err) {
          if (err.code === 'P2002') {
            alreadyRecorded.push(m);
            continue;
          }
          throw err;
        }
      }
      await writeAudit(tx, 'support_batch_create', {
        tagId, operator,
        extraDetails: {
          tagName: tag.name, serviceItemId, serviceDate,
          totalInput: normalizedInputs.length,
          created: created.length,
          alreadyRecorded: alreadyRecorded.length,
          unmatched: unmatched.length,
          ambiguous: ambiguous.length,
          additionalTagIds,
        },
      });
    });

    const slim = (v) => ({ id: v.id, volunteerCode: v.volunteerCode, chineseName: v.chineseName });
    return {
      total: normalizedInputs.length,
      created,
      alreadyRecorded: alreadyRecorded.map((m) => ({ input: m.input, volunteer: slim(m.volunteer) })),
      unmatched,
      ambiguous: ambiguous.map((m) => ({ input: m.input, candidates: m.candidates.map(slim) })),
    };
  }

  /**
   * Bulk-update ProjectSupport fields (duration / serviceDate / description)
   * for all supports attached to this tag OR a subset specified by supportIds.
   *
   * dryRun: returns preview of what would change without mutating.
   */
  static async batchUpdate(tagId, payload, operator) {
    const tag = await prisma.tag.findUnique({ where: { id: tagId }, include: { group: true } });
    if (!tag) return { notFound: true };
    if (tag.group.opMode !== 'managed') {
      return { forbidden: `标签组 "${tag.group.name}" 不是 managed 模式` };
    }
    if (!isPrivileged(operator)) return { forbidden: '批量修改需要 a_admin+' };

    const { patch = {}, scope = 'all', supportIds = [], dryRun = false } = payload;

    const data = {};
    if (patch.duration !== undefined) {
      if (typeof patch.duration !== 'number' || patch.duration <= 0 || patch.duration % 0.5 !== 0) {
        return { validationError: 'duration 必须是大于 0 的 0.5 倍数' };
      }
      data.duration = patch.duration;
    }
    if (patch.serviceDate !== undefined) {
      const d = new Date(patch.serviceDate);
      if (Number.isNaN(d.getTime())) return { validationError: 'serviceDate 格式无效' };
      data.serviceDate = d;
    }
    if (patch.description !== undefined) {
      const desc = String(patch.description).trim();
      if (desc.length < 5 || desc.length > 1000) return { validationError: 'description 长度 5-1000' };
      data.description = desc;
    }
    if (Object.keys(data).length === 0) return { validationError: '没有可更新字段' };

    // Resolve scope
    const scopeWhere = {
      status: 'ACTIVE',
      tagAttachments: { some: { tagId } },
    };
    if (scope === 'subset') {
      if (!Array.isArray(supportIds) || supportIds.length === 0) {
        return { validationError: 'scope=subset 时 supportIds 不能为空' };
      }
      scopeWhere.id = { in: supportIds };
    }

    const targets = await prisma.projectSupport.findMany({
      where: scopeWhere,
      select: {
        id: true, supportId: true, duration: true, serviceDate: true, description: true,
      },
    });

    // Compute a rough "homogeneity" summary to warn admin
    const durations = Array.from(new Set(targets.map((t) => t.duration)));
    const preview = {
      scopeCount: targets.length,
      currentDurationRange: durations.length > 0 ? {
        min: Math.min(...durations), max: Math.max(...durations), distinct: durations.length,
      } : null,
      willUpdate: data,
    };

    if (dryRun || targets.length === 0) {
      return { dryRun: true, preview };
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedCount = await tx.projectSupport.updateMany({
        where: { id: { in: targets.map((t) => t.id) } },
        data,
      });
      await writeAudit(tx, 'support_batch_update', {
        tagId, operator,
        extraDetails: {
          tagName: tag.name, scope, patch: data, preview,
          affectedIds: targets.slice(0, 20).map((t) => t.supportId),
          totalAffected: updatedCount.count,
        },
      });
      return { updatedCount: updatedCount.count };
    });

    return { ...result, preview };
  }

  /**
   * Bulk-soft-delete supports attached to this tag. Goes to status=DELETED,
   * same as individual soft-delete. The TagAttachment rows are intentionally
   * kept (so a restore re-links them); listSupports filters by status=ACTIVE
   * so deleted members drop out of the tag view.
   */
  static async batchDelete(tagId, payload, operator) {
    const tag = await prisma.tag.findUnique({ where: { id: tagId }, include: { group: true } });
    if (!tag) return { notFound: true };
    if (tag.group.opMode !== 'managed') {
      return { forbidden: `标签组 "${tag.group.name}" 不是 managed 模式` };
    }
    if (!isPrivileged(operator)) return { forbidden: '批量删除需要 a_admin+' };

    const { scope = 'all', supportIds = [], dryRun = false } = payload;

    const scopeWhere = {
      status: 'ACTIVE',
      tagAttachments: { some: { tagId } },
    };
    if (scope === 'subset') {
      if (!Array.isArray(supportIds) || supportIds.length === 0) {
        return { validationError: 'scope=subset 时 supportIds 不能为空' };
      }
      scopeWhere.id = { in: supportIds };
    }

    const targets = await prisma.projectSupport.findMany({
      where: scopeWhere,
      select: {
        id: true, supportId: true,
        volunteer: { select: { volunteerCode: true, chineseName: true } },
      },
      take: 500,
    });

    if (dryRun || targets.length === 0) {
      return {
        dryRun: true,
        preview: {
          scopeCount: targets.length,
          sample: targets.slice(0, 10).map((t) => ({
            supportId: t.supportId,
            volunteer: t.volunteer ? `${t.volunteer.chineseName} (${t.volunteer.volunteerCode})` : '未知',
          })),
        },
      };
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.projectSupport.updateMany({
        where: { id: { in: targets.map((t) => t.id) } },
        data: { status: 'DELETED' },
      });
      await writeAudit(tx, 'support_batch_delete', {
        tagId, operator,
        extraDetails: {
          tagName: tag.name, scope, totalAffected: updated.count,
          affectedIds: targets.slice(0, 20).map((t) => t.supportId),
        },
      });
      return { deletedCount: updated.count };
    });

    return result;
  }

  /**
   * Bulk-attach this tag to a list of existing supports (supportIds OR
   * candidates resolved from names + filters). No new PS created.
   */
  static async batchAttach(tagId, payload, operator) {
    const tag = await prisma.tag.findUnique({ where: { id: tagId }, include: { group: true } });
    if (!tag) return { notFound: true };
    if (!isPrivileged(operator)) return { forbidden: '批量贴 tag 需要 a_admin+' };

    const { supportIds = [] } = payload;
    if (!Array.isArray(supportIds) || supportIds.length === 0) {
      return { validationError: 'supportIds 不能为空' };
    }

    // Fetch candidate supports to enforce group.boundServiceItemIds
    const supports = await prisma.projectSupport.findMany({
      where: { id: { in: supportIds }, status: 'ACTIVE' },
      select: { id: true, supportId: true, serviceItemId: true },
    });

    const allowed = [];
    const rejectedByBinding = [];
    for (const s of supports) {
      if (tag.group.boundServiceItemIds.length > 0 &&
          !tag.group.boundServiceItemIds.includes(s.serviceItemId)) {
        rejectedByBinding.push(s.supportId);
      } else {
        allowed.push(s);
      }
    }

    const attached = [];
    const alreadyAttached = [];
    await prisma.$transaction(async (tx) => {
      for (const s of allowed) {
        // If single-selection group, detach other tags from same group
        if (tag.group.selectionMode === 'single') {
          await tx.tagAttachment.deleteMany({
            where: { supportId: s.id, tag: { groupId: tag.groupId }, NOT: { tagId } },
          });
        }
        const existing = await tx.tagAttachment.findUnique({
          where: { tagId_supportId: { tagId, supportId: s.id } },
        });
        if (existing) {
          alreadyAttached.push(s.supportId);
          continue;
        }
        await tx.tagAttachment.create({
          data: { tagId, supportId: s.id, attachedById: operator.volunteerId },
        });
        attached.push(s.supportId);
      }
      await writeAudit(tx, 'support_batch_attach', {
        tagId, operator,
        extraDetails: {
          tagName: tag.name,
          attached: attached.length,
          alreadyAttached: alreadyAttached.length,
          rejectedByBinding: rejectedByBinding.length,
        },
      });
    });

    return { attached, alreadyAttached, rejectedByBinding };
  }

  /** Bulk detach this tag from supports. No PS deletion. */
  static async batchDetach(tagId, payload, operator) {
    const tag = await prisma.tag.findUnique({ where: { id: tagId }, include: { group: true } });
    if (!tag) return { notFound: true };
    if (!isPrivileged(operator)) return { forbidden: '批量解除关联需要 a_admin+' };

    const { supportIds = [] } = payload;
    if (!Array.isArray(supportIds) || supportIds.length === 0) {
      return { validationError: 'supportIds 不能为空' };
    }

    const result = await prisma.$transaction(async (tx) => {
      const deleted = await tx.tagAttachment.deleteMany({
        where: { tagId, supportId: { in: supportIds } },
      });
      await writeAudit(tx, 'support_batch_detach', {
        tagId, operator,
        extraDetails: {
          tagName: tag.name, detached: deleted.count, supportIds: supportIds.slice(0, 50),
        },
      });
      return { detached: deleted.count };
    });

    return result;
  }
}

export default TagService;
