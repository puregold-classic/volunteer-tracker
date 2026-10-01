import prisma from '../utils/prismaClient.js';
import IDGenerator from '../utils/IDGenerator.js';
import { serializeTagGroup, serializeTag, serializeProjectSupport } from '../utils/serializer.js';
import { LedgerError, ledgerTransaction } from '../utils/ledgerPolicy.js';
import { groupApplies, recordTagPermission, saveRecordTags } from './TagRules.js';

const groupsInclude = { tags: { orderBy: { name: 'asc' } } };
const supportInclude = { volunteer: { include: { department: true } }, serviceItem: { include: { department: true } }, submittedBy: true, submittedByAccount: true, tagAttachments: { include: { tag: { include: { group: true } } } } };
const manager = (op) => ['admin', 'a_admin', 'b_admin'].includes(op?.role);
const requireAdmin = (op) => { if (op?.role !== 'admin') throw new LedgerError(403, '标签组配置需要系统管理员权限'); };
const recordScope = (op) => op.role === 'a_admin' ? { volunteer: { departmentId: op.departmentId || '__none__' } } : manager(op) ? {} : { volunteerId: op.volunteerId || '__none__' };
const paging = (query) => { const take = Math.min(100, Math.max(1, Math.trunc(Number(query.limit) || 30))), page = Math.max(1, Math.trunc(Number(query.page) || 1)); return { take, skip: (page - 1) * take }; };
const searchWhere = (search) => search ? { OR: [{ supportId: { contains: String(search), mode: 'insensitive' } }, { volunteer: { OR: ['chineseName', 'englishName', 'volunteerCode'].map((key) => ({ [key]: { contains: String(search), mode: 'insensitive' } })) } }] } : {};
async function audit(tx, op, action, targetType, targetId, details) {
  const identity = { id: op.accountId, volunteerId: op.volunteerId ?? null, name: op.name ?? null, role: op.role };
  await tx.auditLog.create({ data: { auditId: IDGenerator.generateAuditId(), action, targetType, targetId, actionDetails: details, operator: identity, submitter: identity } });
}
async function groupData(tx, input, existing) {
  const data = { name: String(input.name ?? existing?.name ?? '').trim(), description: String(input.description ?? existing?.description ?? '').trim(),
    selectionMode: input.selectionMode ?? existing?.selectionMode ?? 'single', openness: input.openness ?? existing?.openness ?? 'closed', required: input.required ?? existing?.required ?? false,
    applicability: input.applicability ?? existing?.applicability ?? 'specified', isActive: input.isActive ?? existing?.isActive ?? true, opMode: 'tag_only' };
  if (!data.name || data.name.length > 80 || data.description.length > 500) throw new LedgerError(400, '标签组名称须为 1–80 字，说明不超过 500 字');
  if (!['single', 'multi'].includes(data.selectionMode) || !['open', 'closed'].includes(data.openness) || typeof data.required !== 'boolean' || typeof data.isActive !== 'boolean') throw new LedgerError(400, '标签组配置无效');
  if (!['all', 'specified'].includes(data.applicability) && !(existing?.applicability === 'legacy' && data.applicability === 'legacy')) throw new LedgerError(400, '请选择所有志愿服务项或指定服务项');
  const raw = input.boundServiceItemIds ?? existing?.boundServiceItemIds ?? [];
  if (!Array.isArray(raw) || raw.some((id) => typeof id !== 'string')) throw new LedgerError(400, '适用服务项格式无效');
  data.boundServiceItemIds = data.applicability === 'specified' ? [...new Set(raw)] : [];
  if (data.applicability === 'specified' && !data.boundServiceItemIds.length) throw new LedgerError(400, '指定模式至少选择一个服务项');
  const items = await tx.serviceItem.findMany({ where: { id: { in: data.boundServiceItemIds } } });
  const invalid = data.boundServiceItemIds.filter((id) => !items.some((i) => i.id === id && i.isActive && i.category !== 'TRAINING_ATTENDANCE') && !existing?.boundServiceItemIds.includes(id));
  if (invalid.length) throw new LedgerError(400, '不能新增已停用、已删除或受训类服务项');
  return data;
}

export default class LabelService {
  static async groups() {
    const [groups, items] = await Promise.all([prisma.tagGroup.findMany({ include: groupsInclude, orderBy: { createdAt: 'asc' } }), prisma.serviceItem.findMany({ select: { id: true, isActive: true, category: true } })]);
    return groups.map((g) => ({ ...serializeTagGroup(g), invalidServiceItemIds: g.boundServiceItemIds.filter((id) => !items.some((i) => i.id === id && i.isActive && i.category !== 'TRAINING_ATTENDANCE')) }));
  }
  static async bound(itemId) {
    const item = await prisma.serviceItem.findUnique({ where: { id: itemId } });
    if (!item || item.category === 'TRAINING_ATTENDANCE') return [];
    const groups = await prisma.tagGroup.findMany({ where: { isActive: true, OR: [{ applicability: 'all' }, { applicability: 'specified', boundServiceItemIds: { has: itemId } }] }, include: { tags: { where: { isActive: true }, orderBy: { name: 'asc' } } }, orderBy: { createdAt: 'asc' } });
    return groups.map(serializeTagGroup);
  }
  static async saveGroup(op, id, input) {
    requireAdmin(op);
    return ledgerTransaction(prisma, async (tx) => {
      const existing = id ? await tx.tagGroup.findUnique({ where: { id } }) : null;
      if (id && !existing) throw new LedgerError(404, '标签组不存在');
      const data = await groupData(tx, input, existing);
      const row = id ? await tx.tagGroup.update({ where: { id }, data, include: groupsInclude }) : await tx.tagGroup.create({ data: { ...data, createdById: op.volunteerId ?? null }, include: groupsInclude });
      await audit(tx, op, id ? 'tag_group_update' : 'tag_group_create', 'TagGroup', row.id, { before: existing, after: data });
      return serializeTagGroup(row);
    });
  }
  static async archiveGroup(op, id) { return this.saveGroup(op, id, { isActive: false }); }
  static async saveTag(op, id, input) {
    return ledgerTransaction(prisma, async (tx) => {
      const existing = id ? await tx.tag.findUnique({ where: { id } }) : null;
      if (id && !existing) throw new LedgerError(404, '标签不存在');
      const group = await tx.tagGroup.findUnique({ where: { id: existing?.groupId || String(input.groupId || '') } });
      if (!group?.isActive) throw new LedgerError(400, '标签组不存在或已停用');
      if (id ? !manager(op) : !manager(op) && group.openness !== 'open') throw new LedgerError(403, '没有维护该标签的权限');
      const name = String(input.name ?? existing?.name ?? '').trim();
      if (!name || name.length > 80) throw new LedgerError(400, '标签名称须为 1–80 字');
      const data = { name, isActive: input.isActive ?? existing?.isActive ?? true };
      if (typeof data.isActive !== 'boolean') throw new LedgerError(400, '标签状态格式无效');
      const tag = id ? await tx.tag.update({ where: { id }, data }) : await tx.tag.create({ data: { ...data, groupId: group.id, createdById: op.volunteerId ?? null } });
      await audit(tx, op, id ? 'tag_update' : 'tag_create', 'Tag', tag.id, { before: existing, after: data });
      return serializeTag(tag);
    });
  }
  static async detail(op, id, query = {}) {
    const tag = await prisma.tag.findUnique({ where: { id }, include: { group: true, migratedTrainingSession: { select: { id: true, name: true } } } });
    if (!tag) throw new LedgerError(404, '标签不存在');
    const scope = { AND: [recordScope(op), searchWhere(query.search)], status: 'ACTIVE', tagAttachments: { some: { tagId: id } } };
    const [rows, total, people] = await Promise.all([
      prisma.projectSupport.findMany({ where: scope, include: supportInclude, orderBy: [{ serviceDate: 'desc' }, { id: 'asc' }], ...paging(query) }),
      prisma.projectSupport.count({ where: scope }), prisma.projectSupport.groupBy({ by: ['volunteerId'], where: scope }),
    ]);
    return { tag: serializeTag(tag), group: serializeTagGroup(tag.group), trainingSession: tag.migratedTrainingSession,
      records: rows.map((r) => ({ ...serializeProjectSupport(r), needsReview: !tag.isActive || !groupApplies(tag.group, r.serviceItem, true) || (tag.group.selectionMode === 'single' && r.tagAttachments.filter((a) => a.tag.groupId === tag.groupId).length > 1) })), total, people: people.length, scoped: op.role === 'a_admin' || !manager(op) };
  }
  static async candidates(op, id, query = {}) {
    const tag = await prisma.tag.findUnique({ where: { id }, include: { group: true } });
    if (!tag?.isActive || !tag.group.isActive) throw new LedgerError(400, '标签或标签组已停用');
    const where = { AND: [recordScope(op), searchWhere(query.search)], status: 'ACTIVE', trainingSessionId: null,
      serviceItem: { category: { not: 'TRAINING_ATTENDANCE' }, isActive: true },
      ...(tag.group.applicability === 'specified' ? { serviceItemId: { in: tag.group.boundServiceItemIds } } : {}) };
    const [rows, total] = await Promise.all([prisma.projectSupport.findMany({ where, include: supportInclude, orderBy: [{ serviceDate: 'desc' }, { id: 'asc' }], ...paging(query) }), prisma.projectSupport.count({ where })]);
    return { records: rows.map(serializeProjectSupport), total };
  }
  static async replace(op, recordId, ids) {
    return ledgerTransaction(prisma, async (tx) => {
      const record = await tx.projectSupport.findFirst({ where: { OR: [{ id: recordId }, { supportId: recordId }] }, include: supportInclude });
      await recordTagPermission(tx, record, op);
      record.tagAttachments = await saveRecordTags(tx, record, ids, op, { manual: true });
      return serializeProjectSupport(record);
    });
  }
  static async link(op, tagId, recordId, remove = false) {
    return ledgerTransaction(prisma, async (tx) => {
      const record = await tx.projectSupport.findFirst({ where: { OR: [{ id: recordId }, { supportId: recordId }] }, include: supportInclude });
      await recordTagPermission(tx, record, op);
      const tag = await tx.tag.findUnique({ where: { id: tagId }, include: { group: true } });
      if (!tag) throw new LedgerError(404, '标签不存在');
      let selected = record.tagAttachments.map((a) => a.tagId);
      if (remove) selected = selected.filter((id) => id !== tagId);
      else {
        if (!tag.isActive || !groupApplies(tag.group, record.serviceItem, true)) throw new LedgerError(400, '该标签已停用或不适用于此服务记录');
        if (tag.group.selectionMode === 'single') selected = record.tagAttachments.filter((a) => a.tag.groupId !== tag.groupId).map((a) => a.tagId);
        selected.push(tagId);
      }
      record.tagAttachments = await saveRecordTags(tx, record, selected, op, { manual: true });
      return serializeProjectSupport(record);
    });
  }
  static async record(op, code) {
    const record = await prisma.projectSupport.findFirst({ where: { supportId: code, ...recordScope(op) }, include: supportInclude });
    if (!record) throw new LedgerError(404, '记录不存在或不可查看');
    return serializeProjectSupport(record);
  }
}
