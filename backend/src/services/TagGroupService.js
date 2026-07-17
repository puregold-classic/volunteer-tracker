// src/services/TagGroupService.js — v3.2
//
// Tag groups are admin-managed config entities. Each group declares:
//   - selectionMode (single/multi UI picker)
//   - opMode        (managed allows batch create/update/delete, tag_only only attach/detach)
//   - openness      (closed = fixed tag values; open = admins can add at runtime)
//   - required      (whether picking is mandatory when bound serviceItem is chosen)
//   - boundServiceItemIds  (which serviceItems surface this group in the submit UI)
//
// Permission model (v3.2):
//   - admin  = full CRUD on groups
//   - a_admin = can CRUD tags within groups (phase 2 also allows destructive batch ops)
//   - b_admin = can attach/detach only
//   - user   = can attach/detach (subject to support ownership rules)

import prisma from '../utils/prismaClient.js';
import IDGenerator from '../utils/IDGenerator.js';
import { serializeTagGroup } from '../utils/serializer.js';

const GROUP_INCLUDE = {
  tags: { orderBy: { name: 'asc' } },
  createdBy: { select: { id: true, volunteerCode: true, chineseName: true } },
};

const VALID_SELECTION = new Set(['single', 'multi']);
const VALID_OP_MODE = new Set(['managed', 'tag_only']);
const VALID_OPENNESS = new Set(['closed', 'open']);

const writeAudit = async (tx, action, { groupId, operator, extraDetails = {}, changes = [] }) => {
  await tx.auditLog.create({
    data: {
      auditId: IDGenerator.generateAuditId(),
      targetType: 'TagGroup',
      targetId: groupId,
      action,
      actionDetails: extraDetails,
      modifiedId: groupId,
      changes,
      operator: serializeOperator(operator),
      submitter: serializeOperator(operator),
    },
  });
};

const serializeOperator = (op) => ({
  id: op?.accountId ?? null,
  volunteerId: op?.volunteerId ?? null,
  name: op?.name ?? null,
  role: op?.role ?? null,
});

class TagGroupService {
  static async listAll() {
    const rows = await prisma.tagGroup.findMany({
      include: GROUP_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(serializeTagGroup);
  }

  static async findById(id) {
    const row = await prisma.tagGroup.findUnique({
      where: { id },
      include: GROUP_INCLUDE,
    });
    return row ? serializeTagGroup(row) : null;
  }

  /**
   * Groups whose boundServiceItemIds include the given serviceItemId. Submit
   * form calls this to know which pickers to surface when user selects an item.
   */
  static async findBoundTo(serviceItemId) {
    if (!serviceItemId) return [];
    const rows = await prisma.tagGroup.findMany({
      where: { boundServiceItemIds: { has: serviceItemId } },
      include: GROUP_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(serializeTagGroup);
  }

  static async create(input, operator) {
    const {
      name, description, boundServiceItemIds = [],
      selectionMode = 'single', opMode = 'tag_only', openness = 'closed',
      required = false,
    } = input;

    if (!name || typeof name !== 'string' || name.trim().length < 1) {
      return { validationError: 'name 必填' };
    }
    if (!VALID_SELECTION.has(selectionMode)) return { validationError: `selectionMode 非法: ${selectionMode}` };
    if (!VALID_OP_MODE.has(opMode))           return { validationError: `opMode 非法: ${opMode}` };
    if (!VALID_OPENNESS.has(openness))        return { validationError: `openness 非法: ${openness}` };
    // v3.7: pure system admin (volunteerId=null) may create tag groups — createdById
    // is now optional audit provenance, no volunteer identity required.

    // Validate bound service item ids all exist
    if (boundServiceItemIds.length > 0) {
      const count = await prisma.serviceItem.count({
        where: { id: { in: boundServiceItemIds } },
      });
      if (count !== boundServiceItemIds.length) {
        return { validationError: '部分 serviceItem 不存在' };
      }
    }

    try {
      const created = await prisma.$transaction(async (tx) => {
        const group = await tx.tagGroup.create({
          data: {
            name: name.trim(),
            description: description ?? null,
            boundServiceItemIds,
            selectionMode,
            opMode,
            openness,
            required,
            // null when a pure system admin (volunteerId=null) creates it — tag
            // groups are org-config, not owned. Provenance still lands in AuditLog.
            createdById: operator.volunteerId ?? null,
          },
          include: GROUP_INCLUDE,
        });
        await writeAudit(tx, 'tag_group_create', { groupId: group.id, operator,
          extraDetails: { name: group.name, selectionMode, opMode, openness } });
        return group;
      });
      return { group: serializeTagGroup(created) };
    } catch (err) {
      if (err.code === 'P2002') return { conflict: '标签组名已存在' };
      throw err;
    }
  }

  static async update(id, patch, operator) {
    const existing = await prisma.tagGroup.findUnique({ where: { id } });
    if (!existing) return { notFound: true };

    const data = {};
    const changes = [];
    const track = (field, from, to) => {
      if (from !== to) { data[field] = to; changes.push({ field, from, to }); }
    };

    if (patch.name !== undefined) track('name', existing.name, String(patch.name).trim());
    if (patch.description !== undefined) track('description', existing.description, patch.description ?? null);
    if (patch.required !== undefined) track('required', existing.required, !!patch.required);

    if (patch.selectionMode !== undefined) {
      if (!VALID_SELECTION.has(patch.selectionMode)) return { validationError: `selectionMode 非法` };
      track('selectionMode', existing.selectionMode, patch.selectionMode);
    }
    if (patch.opMode !== undefined) {
      if (!VALID_OP_MODE.has(patch.opMode)) return { validationError: `opMode 非法` };
      track('opMode', existing.opMode, patch.opMode);
    }
    if (patch.openness !== undefined) {
      if (!VALID_OPENNESS.has(patch.openness)) return { validationError: `openness 非法` };
      track('openness', existing.openness, patch.openness);
    }
    if (patch.boundServiceItemIds !== undefined) {
      const ids = Array.isArray(patch.boundServiceItemIds) ? patch.boundServiceItemIds : [];
      if (ids.length > 0) {
        const count = await prisma.serviceItem.count({ where: { id: { in: ids } } });
        if (count !== ids.length) return { validationError: '部分 serviceItem 不存在' };
      }
      // JSON compare for array change detection
      if (JSON.stringify(existing.boundServiceItemIds) !== JSON.stringify(ids)) {
        data.boundServiceItemIds = ids;
        changes.push({ field: 'boundServiceItemIds', from: existing.boundServiceItemIds, to: ids });
      }
    }

    if (changes.length === 0) {
      return { group: serializeTagGroup(await prisma.tagGroup.findUnique({ where: { id }, include: GROUP_INCLUDE })) };
    }

    try {
      const updated = await prisma.$transaction(async (tx) => {
        const group = await tx.tagGroup.update({
          where: { id },
          data,
          include: GROUP_INCLUDE,
        });
        await writeAudit(tx, 'tag_group_update', { groupId: id, operator, changes });
        return group;
      });
      return { group: serializeTagGroup(updated) };
    } catch (err) {
      if (err.code === 'P2002') return { conflict: '标签组名已存在' };
      throw err;
    }
  }

  /**
   * Hard-delete a group. Cascade removes tags + attachments via FK.
   * Refuses if any tag still has attachments and cascadeAttachments=false.
   */
  static async remove(id, operator, { cascadeAttachments = false } = {}) {
    const existing = await prisma.tagGroup.findUnique({
      where: { id },
      include: { tags: { include: { _count: { select: { attachments: true } } } } },
    });
    if (!existing) return { notFound: true };

    const totalAttachments = existing.tags.reduce((n, t) => n + (t._count?.attachments ?? 0), 0);
    if (totalAttachments > 0 && !cascadeAttachments) {
      return {
        conflict: `组内 ${existing.tags.length} 个 tag 共 ${totalAttachments} 条关联，删除会解除所有关联。再次调用时传 cascadeAttachments=true 确认`,
        attachmentCount: totalAttachments,
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.tagGroup.delete({ where: { id } });
      await writeAudit(tx, 'tag_group_delete', {
        groupId: id, operator,
        extraDetails: { name: existing.name, tagCount: existing.tags.length, attachmentCount: totalAttachments },
      });
    });
    return { deleted: true, tagCount: existing.tags.length, attachmentCount: totalAttachments };
  }
}

export default TagGroupService;
