import { createHash } from 'node:crypto';
import { LedgerError, ledgerTransaction } from '../utils/ledgerPolicy.js';
import IDGenerator from '../utils/IDGenerator.js';

// Explicit manifest only. Mixed data is never silently split or merged.
export async function migrateTraining(db, manifest, operator, { apply = false } = {}) {
  if (operator?.role !== 'admin' || !operator.accountId) throw new LedgerError(403, '迁移必须记录真实系统管理员 Account');
  if (!manifest || !Array.isArray(manifest.sessions)) throw new LedgerError(400, '迁移清单缺少 sessions');
  const seen = new Set(), keys = new Set();
  for (const mapping of manifest.sessions) {
    if (typeof mapping.key !== 'string' || !mapping.key || keys.has(mapping.key) || typeof mapping.name !== 'string' || !mapping.name.trim() || !Array.isArray(mapping.supportIds) || !mapping.supportIds.length) throw new LedgerError(400, '场次映射必须有唯一 key、名称及记录 ID 清单');
    keys.add(mapping.key);
    for (const id of mapping.supportIds) { if (typeof id !== 'string' || seen.has(id)) throw new LedgerError(400, '同一服务记录只能出现在一个场次映射中'); seen.add(id); }
  }
  return ledgerTransaction(db, async (tx) => {
    const result = [];
    for (const mapping of manifest.sessions) {
      const id = `training_migrated_${createHash('sha256').update(mapping.key).digest('hex').slice(0, 24)}`;
      const records = await tx.projectSupport.findMany({ where: { id: { in: mapping.supportIds } }, include: { serviceItem: true }, orderBy: { id: 'asc' } });
      if (records.length !== mapping.supportIds.length) throw new LedgerError(400, `${mapping.name}：部分记录不存在`);
      const first = records[0];
      if (records.some((r) => r.serviceItem.category !== 'TRAINING_ATTENDANCE' || !['ACTIVE', 'DELETED'].includes(r.status))) throw new LedgerError(400, `${mapping.name}：只支持有效／已移除的受训记录`);
      if (new Set(records.map((r) => r.volunteerId)).size !== records.length) throw new LedgerError(400, `${mapping.name}：同人多条记录须先明确场次归属`);
      if (records.some((r) => r.trainingSessionId && r.trainingSessionId !== id)) throw new LedgerError(409, `${mapping.name}：记录已归属其他场次`);
      const existing = await tx.trainingSession.findUnique({ where: { id }, include: { attendances: true } });
      if (existing) {
        // Compare the original migration, not the live roster: later additions,
        // removals and edits must not make the same manifest unsafe to rerun.
        const audit = await tx.auditLog.findFirst({ where: { targetType: 'TrainingSession', targetId: id, action: 'training_migrate' } });
        const originalIds = audit?.actionDetails?.supportIds;
        if (!Array.isArray(originalIds) || originalIds.length !== records.length || originalIds.some((supportId) => !mapping.supportIds.includes(supportId))
          || records.some((r) => r.trainingSessionId !== id) || existing.legacyTagId !== (mapping.legacyTagId || null)) throw new LedgerError(409, `${mapping.name}：映射已执行，不能改变记录集合或原标签`);
        result.push({ key: mapping.key, sessionId: id, status: 'already_migrated', recordCount: records.length }); continue;
      }
      const signature = (r) => JSON.stringify([r.serviceItemId, r.serviceDate.toISOString().slice(0, 10), r.duration, r.description]);
      if (records.some((r) => signature(r) !== signature(first))) throw new LedgerError(400, `${mapping.name}：混合日期、类型、时长或内容，请提供明确分场映射`);
      if (mapping.legacyTagId) {
        const links = await tx.tagAttachment.findMany({ where: { tagId: mapping.legacyTagId }, select: { supportId: true } });
        if (links.length !== records.length || links.some((a) => !mapping.supportIds.includes(a.supportId))) throw new LedgerError(400, `${mapping.name}：标签含其他记录，不能将整标签设为单场次跳转`);
      }
      if (apply) {
        const session = await tx.trainingSession.create({ data: { id, name: mapping.name.trim(), serviceItemId: first.serviceItemId, serviceDate: first.serviceDate, duration: first.duration, description: first.description,
          createdByAccountId: operator.accountId, updatedByAccountId: operator.accountId, legacyTagId: mapping.legacyTagId || null } });
        await tx.projectSupport.updateMany({ where: { id: { in: mapping.supportIds } }, data: { trainingSessionId: id } });
        for (const record of records) await tx.trainingAttendance.create({ data: { sessionId: id, volunteerId: record.volunteerId, supportId: record.id, removedAt: record.status === 'DELETED' ? record.updatedAt : null } });
        if (mapping.legacyTagId) await tx.tag.update({ where: { id: mapping.legacyTagId }, data: { isActive: false } });
        const identity = { id: operator.accountId, role: operator.role, name: operator.name ?? null };
        await tx.auditLog.create({ data: { auditId: IDGenerator.generateAuditId(), targetType: 'TrainingSession', targetId: session.id, action: 'training_migrate', actionDetails: { key: mapping.key, legacyTagId: mapping.legacyTagId ?? null, supportIds: mapping.supportIds }, operator: identity, submitter: identity } });
      }
      result.push({ key: mapping.key, sessionId: id, status: apply ? 'migrated' : 'ready', recordCount: records.length });
    }
    return { applied: apply, sessions: result };
  });
}
