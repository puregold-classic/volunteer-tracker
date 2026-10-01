import { LedgerError, canManageVolunteer, assertUnlocked } from '../utils/ledgerPolicy.js';
import IDGenerator from '../utils/IDGenerator.js';

export const groupApplies = (group, item, manual = false) => group.isActive !== false && item.isActive !== false && item.category !== 'TRAINING_ATTENDANCE'
  && (group.applicability === 'all' || (group.applicability === 'legacy' && manual) || group.boundServiceItemIds.includes(item.id));
export async function recordTagPermission(tx, support, op) {
  if (!support || !['ACTIVE', 'PENDING_CONFIRMATION'].includes(support.status)) throw new LedgerError(400, '只能维护有效或待确认记录的标签');
  if (support.trainingSessionId || support.serviceItem.category === 'TRAINING_ATTENDANCE') throw new LedgerError(400, '受训考勤请在培训场次中维护');
  // Keep a department head's scope even for their earlier proxy submissions.
  if (op.role === 'a_admin' ? !canManageVolunteer(op, support.volunteer) : !canManageVolunteer(op, support.volunteer) && support.volunteerId !== op.volunteerId && support.submittedById !== op.volunteerId) throw new LedgerError(403, '不能维护此记录的标签');
  await assertUnlocked(tx, op, support.serviceDate);
}
export async function saveRecordTags(tx, support, tagIds, op, { serviceChanged = false, manual = false } = {}) {
  if (!Array.isArray(tagIds) || tagIds.length > 100 || tagIds.some((id) => typeof id !== 'string')) throw new LedgerError(400, '标签选择格式无效（最多 100 个）');
  const selected = [...new Set(tagIds)];
  const previous = await tx.tagAttachment.findMany({ where: { supportId: support.id }, include: { tag: { include: { group: true } } } });
  const priorIds = new Set(previous.map((a) => a.tagId));
  const tags = await tx.tag.findMany({ where: { id: { in: selected } }, include: { group: true } });
  if (tags.length !== selected.length) throw new LedgerError(400, '部分标签不存在，请重新选择');
  const item = await tx.serviceItem.findUnique({ where: { id: support.serviceItemId } });
  const groups = await tx.tagGroup.findMany({ where: { isActive: true } });
  const invalid = tags.filter((t) => (!t.isActive || !groupApplies(t.group, item, manual)) && (serviceChanged || !priorIds.has(t.id)));
  if (invalid.length) throw new LedgerError(400, `以下标签不适用或已停用：${invalid.map((t) => t.name).join('、')}。请移除或更换后再保存。`);
  for (const group of groups) {
    const picked = tags.filter((t) => t.groupId === group.id);
    if (group.selectionMode === 'single' && picked.length > 1) throw new LedgerError(400, `“${group.name}”只能选择一个标签`);
    if (group.required && groupApplies(group, item) && !picked.some((t) => t.isActive)) throw new LedgerError(400, `请选择必填标签：“${group.name}”`);
  }
  const removed = previous.filter((a) => !selected.includes(a.tagId));
  const added = tags.filter((t) => !priorIds.has(t.id));
  if (removed.length) await tx.tagAttachment.deleteMany({ where: { id: { in: removed.map((a) => a.id) } } });
  for (const tag of added) await tx.tagAttachment.create({ data: { tagId: tag.id, supportId: support.id, attachedById: op.volunteerId ?? null, attachedByAccountId: op.accountId } });
  if (added.length || removed.length) {
    const identity = { id: op.accountId, volunteerId: op.volunteerId ?? null, name: op.name ?? null, role: op.role };
    await tx.auditLog.create({ data: { auditId: IDGenerator.generateAuditId(), targetType: 'ProjectSupport', targetId: support.id, modifiedId: support.supportId,
      action: added.length ? 'tag_attach' : 'tag_detach', actionDetails: { added: added.map((t) => t.id), removed: removed.map((a) => a.tagId) }, operator: identity, submitter: identity } });
  }
  return tx.tagAttachment.findMany({ where: { supportId: support.id }, include: { tag: { include: { group: true } } } });
}
