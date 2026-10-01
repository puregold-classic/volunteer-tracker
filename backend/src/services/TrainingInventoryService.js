// Read-only inventory. Explicit selections also work before the training migration.
import { createHash } from 'node:crypto';

export function summarizeTrainingInventory(records, groups) {
  const training = records.filter((r) => r.serviceItem.category === 'TRAINING_ATTENDANCE');
  const tags = new Map();
  for (const row of records) for (const link of row.tagAttachments) {
    if (!tags.has(link.tag.id)) tags.set(link.tag.id, { tag: link.tag, records: [] });
    tags.get(link.tag.id).records.push(row);
  }
  const candidates = [], review = [];
  for (const { tag, records: rows } of tags.values()) {
    if (!rows.some((r) => r.serviceItem.category === 'TRAINING_ATTENDANCE')) continue;
    const reasons = [];
    const signatures = new Set(rows.map((r) => JSON.stringify([r.serviceItemId, r.serviceDate.toISOString().slice(0, 10), r.duration, r.description])));
    if (rows.some((r) => r.serviceItem.category !== 'TRAINING_ATTENDANCE')) reasons.push('混合服务类别');
    if (signatures.size > 1) reasons.push('日期、类型、时长或内容不一致');
    if (new Set(rows.map((r) => r.volunteerId)).size !== rows.length) reasons.push('同人多条记录（含历史状态）');
    if (rows.some((r) => r.tagAttachments.length > 1)) reasons.push('记录有多重标签关联，需确认场次来源');
    if (rows.some((r) => !['ACTIVE', 'DELETED'].includes(r.status))) reasons.push('包含待确认或拒绝记录');
    const entry = { tagId: tag.id, name: tag.name, groupId: tag.groupId, supportIds: rows.map((r) => r.id).sort(), recordCodes: rows.map((r) => r.supportId), reasons };
    (reasons.length ? review : candidates).push(entry);
  }
  const totals = {};
  for (const r of records) {
    const key = `${r.volunteerId}|${r.serviceItem.category}|${r.serviceDate.toISOString().slice(0, 10)}|${r.status}`;
    totals[key] ??= { records: 0, hours: 0 };
    totals[key].records++;
    totals[key].hours += r.duration;
  }
  return {
    fingerprint: createHash('sha256').update(JSON.stringify(records)).digest('hex'),
    summary: { allRecords: records.length, trainingRecords: training.length, activeTrainingRecords: training.filter((r) => r.status === 'ACTIVE').length,
      activeTrainingPeople: new Set(training.filter((r) => r.status === 'ACTIVE').map((r) => r.volunteerId)).size,
      activeTrainingHours: training.filter((r) => r.status === 'ACTIVE').reduce((n, r) => n + r.duration, 0) },
    candidates, review,
    untagged: training.filter((r) => !r.tagAttachments.length).map((r) => ({ id: r.id, supportId: r.supportId, status: r.status })),
    emptyScopeGroups: groups.filter((g) => !g.boundServiceItemIds.length).map((g) => ({ id: g.id, name: g.name, meaning: '表单不显示；旧手工关联不限范围' })),
    attributionToReview: records.filter((r) => r.submittedById === r.volunteerId).map((r) => r.id),
    attributionNote: '本人提交和旧 admin 回退无法仅凭 submittedById 区分；上述清单是候选，不自动改写历史身份。',
    totals,
  };
}

export async function trainingInventory(db) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const records = await tx.projectSupport.findMany({ orderBy: { id: 'asc' }, select: {
      id: true, supportId: true, volunteerId: true, submittedById: true, serviceItemId: true,
      serviceDate: true, duration: true, description: true, status: true,
      serviceItem: { select: { category: true } },
      tagAttachments: { orderBy: { tagId: 'asc' }, select: { tag: { select: { id: true, name: true, groupId: true } } } },
    } });
    const groups = await tx.tagGroup.findMany({ orderBy: { id: 'asc' }, select: { id: true, name: true, boundServiceItemIds: true } });
    return summarizeTrainingInventory(records, groups);
  }, { isolationLevel: 'RepeatableRead', timeout: 60000 });
}
