import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
vi.mock('../src/utils/prismaClient.js', async () => {
  const { pathToFileURL } = await import('node:url');
  const { PrismaClient } = await import(pathToFileURL(`${process.env.TRAINING_TEST_WORKDIR}/new-client/index.js`).href);
  return { default: new PrismaClient() };
});
import db from '../src/utils/prismaClient.js';
import TrainingService from '../src/services/TrainingService.js';
import ProjectSupportService from '../src/services/ProjectSupportService.js';
import SupportLedgerService from '../src/services/SupportLedgerService.js';
import ExportService from '../src/services/ExportService.js';
import AuditService from '../src/services/AuditService.js';
import jwt from 'jsonwebtoken';
import { trainingInventory } from '../src/services/TrainingInventoryService.js';
import LabelService from '../src/services/LabelService.js';
import { migrateTraining } from '../src/services/TrainingMigrationService.js';
import { runTrainingBrowser } from './runTrainingBrowser.js';
import { app } from '../src/server.js';
import { createAdminAccount, createVolunteerAccount } from '../src/services/AccountService.js';

let oldDb, admin, member, member2, head, outside, item, ordinary, legacy;
let sequence = 0;
const op = (a) => ({ accountId: a.id, volunteerId: a.volunteerId, role: a.role, name: a.name, departmentId: a.volunteer?.departmentId || 'TRAIN_A' });
const input = () => ({ name: `笔译培训 ${++sequence}`, serviceItemId: item.id, serviceDate: '2026-09-01', duration: 2, description: '学习翻译方法与实践' });
const person = async (name, departmentId = 'TRAIN_A', role = 'user') => {
  const result = await createVolunteerAccount({ volunteer: { chineseName: name, englishName: name === '张三' ? 'Alice' : '', departmentId, region: '其他' }, account: { email: `training-${++sequence}@example.test`, password: 'TestOnly@123', role } });
  expect(result.account, JSON.stringify(result)).toBeDefined();
  return result.account;
};

beforeAll(async () => {
  const { PrismaClient } = await import(pathToFileURL(`${process.env.TRAINING_TEST_WORKDIR}/old-client/index.js`).href);
  oldDb = new PrismaClient();
  await db.department.createMany({ data: [{ id: 'TRAIN_A', name: '培训测试部门甲', displayOrder: 901 }, { id: 'TRAIN_B', name: '培训测试部门乙', displayOrder: 902 }] });
  admin = (await createAdminAccount({ email: 'training-admin@example.test', password: 'TestOnly@123', name: '培训管理员' })).account;
  member = await person('张三'); member2 = await person('李四'); head = await person('部长', 'TRAIN_A', 'a_admin'); outside = await person('王五', 'TRAIN_B');
  item = await db.serviceItem.create({ data: { name: '笔译受训', departmentId: 'TRAIN_A', category: 'TRAINING_ATTENDANCE', displayOrder: 1 } });
  ordinary = await db.serviceItem.create({ data: { name: '普通服务', departmentId: 'TRAIN_A', category: 'PROJECT_SUPPORT', displayOrder: 2 } });
  await db.serviceItem.create({ data: { name: '协调服务', departmentId: 'TRAIN_A', category: 'PROJECT_MGMT', displayOrder: 4 } });
  legacy = await oldDb.projectSupport.create({ data: { supportId: 'PS-LEGACY-001', volunteerId: member.volunteerId, submittedById: member.volunteerId, serviceItemId: item.id, serviceDate: new Date('2026-08-01'), duration: 2, description: '历史培训记录' } });
  const group = await oldDb.tagGroup.create({ data: { name: '旧培训', boundServiceItemIds: [], opMode: 'managed' } });
  const tag = await oldDb.tag.create({ data: { name: '历史培训场次', groupId: group.id } });
  await oldDb.tagAttachment.create({ data: { tagId: tag.id, supportId: legacy.id, attachedById: member.volunteerId } });
  const before = await trainingInventory(oldDb);
  expect(before.candidates).toHaveLength(1);
  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema', path.join(process.env.TRAINING_TEST_WORKDIR, 'after/schema.prisma')], { env: process.env, stdio: 'pipe', timeout: 60000 });
});

afterAll(async () => { await db.$disconnect(); await oldDb?.$disconnect(); });

describe.sequential('training on real PostgreSQL', () => {
  it('incrementally preserves legacy records and the empty group semantics', async () => {
    expect(await oldDb.projectSupport.findUnique({ where: { id: legacy.id } })).toEqual(legacy);
    expect(await db.tagGroup.findUnique({ where: { name: '旧培训' } })).toMatchObject({ applicability: 'legacy', boundServiceItemIds: [] });
    const report = await trainingInventory(db);
    expect(report.summary.activeTrainingHours).toBe(2);
    expect(report.candidates).toHaveLength(1);
  });
  it('lets pure admin create an empty session, then add plain names through validation', async () => {
    const s = await TrainingService.create(op(admin), input());
    expect((await TrainingService.detail(op(admin), s.id)).activeCount).toBe(0);
    const preview = await TrainingService.validate(op(admin), s.id, { text: '张三\r\n李四\nAlice' });
    expect(preview.rows.map((r) => r.state)).toEqual(['new', 'new', 'duplicate']);
    const added = await TrainingService.add(op(admin), s.id, { version: s.version, volunteerIds: [member.volunteerId, member2.volunteerId] });
    expect(added.created).toHaveLength(2);
    const records = await db.projectSupport.findMany({ where: { trainingSessionId: s.id } });
    expect(records.every((r) => r.submittedByAccountId === admin.id && r.submittedById === null)).toBe(true);
  });
  it('resolves ambiguous names explicitly and matches volunteers beyond the first 500', async () => {
    const copies = await Promise.all([person('同名测试'), person('同名测试', 'TRAIN_B')]);
    const s = await TrainingService.create(op(admin), input());
    const ambiguous = await TrainingService.validate(op(admin), s.id, { text: '同名测试' });
    expect(ambiguous.rows[0].state).toBe('ambiguous');
    expect(ambiguous.rows[0].candidates).toHaveLength(2);
    const chosen = await TrainingService.validate(op(admin), s.id, { text: '同名测试', choices: { 0: copies[1].volunteerId } });
    expect(chosen.rows[0].volunteer.id).toBe(copies[1].volunteerId);
    const data = Array.from({ length: 501 }, (_, n) => ({ id: `training-bulk-${n}`, volunteerCode: `PG-${9000 + n}`, chineseName: `批量测试${n}`, englishName: '', departmentId: 'TRAIN_A', region: 'OTHER' }));
    await db.volunteer.createMany({ data });
    expect((await TrainingService.validate(op(admin), s.id, { text: '批量测试500' })).rows[0].volunteer.id).toBe('training-bulk-500');
    await TrainingService.add(op(admin), s.id, { version: 1, volunteerIds: data.slice(0, 31).map((v) => v.id) });
    const page1 = await TrainingService.detail(op(admin), s.id), page2 = await TrainingService.detail(op(admin), s.id, { page: 2 });
    expect(page1.total).toBe(31); expect(page1.members).toHaveLength(30); expect(page2.members).toHaveLength(1);
    expect(new Set([...page1.members, ...page2.members].map((m) => m.volunteerId)).size).toBe(31);
  });
  it('allows identical attendance snapshots in two different sessions', async () => {
    const data = input();
    const a = await TrainingService.create(op(admin), data), b = await TrainingService.create(op(admin), data);
    for (const s of [a, b]) await TrainingService.add(op(admin), s.id, { version: 1, volunteerIds: [member.volunteerId] });
    expect(await db.projectSupport.count({ where: { trainingSessionId: { in: [a.id, b.id] } } })).toBe(2);
  });
  it('serializes concurrent adds, leaving one record with a refreshable version conflict', async () => {
    const s = await TrainingService.create(op(admin), input());
    const results = await Promise.allSettled([1, 2].map(() => TrainingService.add(op(admin), s.id, { version: 1, volunteerIds: [member.volunteerId] })));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((r) => r.status === 'rejected').reason.status).toBe(409);
    expect(await db.trainingAttendance.count({ where: { sessionId: s.id } })).toBe(1);
    expect(await db.projectSupport.count({ where: { trainingSessionId: s.id } })).toBe(1);
  });
  it('updates all active records and restores the original removed record using current information', async () => {
    const s = await TrainingService.create(op(admin), input());
    await TrainingService.add(op(admin), s.id, { version: 1, volunteerIds: [member.volunteerId, member2.volunteerId] });
    const original = await db.trainingAttendance.findUnique({ where: { sessionId_volunteerId: { sessionId: s.id, volunteerId: member.volunteerId } } });
    await TrainingService.setRemoved(op(admin), s.id, member.volunteerId, { version: 2 }, true);
    const changed = await TrainingService.update(op(admin), s.id, { ...s, version: 3, duration: 3.5 });
    expect(changed.affectedCount).toBe(1);
    const preview = await TrainingService.validate(op(admin), s.id, { text: '张三' });
    expect(preview.rows[0].state).toBe('removed');
    await TrainingService.setRemoved(op(admin), s.id, member.volunteerId, { version: 4 }, false);
    const record = await db.projectSupport.findUnique({ where: { id: original.supportId } });
    expect(record).toMatchObject({ status: 'ACTIVE', duration: 3.5 });
    expect(await db.trainingAttendance.count({ where: { sessionId: s.id } })).toBe(2);
    expect(await db.projectSupport.aggregate({ where: { trainingSessionId: s.id, status: 'ACTIVE' }, _sum: { duration: true } })).toMatchObject({ _sum: { duration: 7 } });
    expect((await ProjectSupportService.update(record.supportId, { duration: 5 }, op(admin))).forbidden).toBeTruthy();
    expect((await ProjectSupportService.remove(record.supportId, op(admin))).forbidden).toBeTruthy();
  });
  it('rejects out-of-scope batch participants atomically, including the version increment', async () => {
    const s = await TrainingService.create(op(head), input());
    await expect(TrainingService.add(op(head), s.id, { version: 1, volunteerIds: [member.volunteerId, outside.volunteerId] })).rejects.toMatchObject({ status: 403 });
    expect(await db.projectSupport.count({ where: { trainingSessionId: s.id } })).toBe(0);
    expect((await db.trainingSession.findUnique({ where: { id: s.id } })).version).toBe(1);
    const preview = await TrainingService.validate(op(head), s.id, { text: '王五' });
    expect(preview.rows[0].state).toBe('unmatched');
    expect(await TrainingService.search(op(head), s.id, { search: '王五' })).toEqual([]);
  });
  it('scopes cross-department roster counts and denies partial whole-session updates', async () => {
    const s = await TrainingService.create(op(admin), input());
    await TrainingService.add(op(admin), s.id, { version: 1, volunteerIds: [member.volunteerId, outside.volunteerId] });
    const detail = await TrainingService.detail(op(head), s.id);
    expect(detail.activeCount).toBe(1); expect(detail.members).toHaveLength(1); expect(detail.canEdit).toBe(false);
    await expect(TrainingService.update(op(head), s.id, { ...s, version: 2, duration: 4 })).rejects.toMatchObject({ status: 403 });
    expect((await db.trainingSession.findUnique({ where: { id: s.id } })).duration).toBe(2);
  });
  it('checks old and new dates for locks and permits audited admin corrections', async () => {
    const s = await TrainingService.create(op(head), input());
    await db.systemSettings.upsert({ where: { id: 1 }, create: { id: 1, lockedBefore: new Date('2026-09-02') }, update: { lockedBefore: new Date('2026-09-02') } });
    try {
      await expect(TrainingService.add(op(head), s.id, { version: 1, volunteerIds: [member.volunteerId] })).rejects.toMatchObject({ status: 423 });
      await expect(TrainingService.update(op(head), s.id, { ...s, serviceDate: '2026-09-03', version: 1 })).rejects.toMatchObject({ status: 423 });
      const open = await TrainingService.create(op(head), { ...input(), serviceDate: '2026-09-03' });
      await expect(TrainingService.update(op(head), open.id, { ...open, serviceDate: '2026-09-01', version: 1 })).rejects.toMatchObject({ status: 423 });
      await TrainingService.add(op(admin), s.id, { version: 1, volunteerIds: [member.volunteerId] });
      expect(await db.auditLog.findFirst({ where: { targetId: s.id, action: 'training_add' } })).toMatchObject({ operator: { id: admin.id }, actionDetails: { adminCorrection: true } });
    } finally { await db.systemSettings.update({ where: { id: 1 }, data: { lockedBefore: null } }); }
  });
  it('owns empty department sessions and rechecks transferred people after preview', async () => {
    const s = await TrainingService.create(op(head), input());
    expect((await TrainingService.detail(op(head), s.id)).canEdit).toBe(true);
    const otherHead = { ...op(head), departmentId: 'TRAIN_B' };
    await expect(TrainingService.detail(otherHead, s.id)).rejects.toMatchObject({ status: 404 });
    const globalEmpty = await TrainingService.create(op(admin), input());
    expect((await TrainingService.detail(op(head), globalEmpty.id)).canEdit).toBe(false);
    expect((await TrainingService.validate(op(head), s.id, { text: '张三' })).rows[0].state).toBe('new');
    await db.volunteer.update({ where: { id: member.volunteerId }, data: { departmentId: 'TRAIN_B' } });
    try { await expect(TrainingService.add(op(head), s.id, { version: 1, volunteerIds: [member.volunteerId] })).rejects.toMatchObject({ status: 403 }); }
    finally { await db.volunteer.update({ where: { id: member.volunteerId }, data: { departmentId: 'TRAIN_A' } }); }
    const recorder = { ...op(head), role: 'b_admin' };
    await db.systemSettings.update({ where: { id: 1 }, data: { lockedBefore: new Date('2026-09-02') } });
    try { await expect(TrainingService.add(recorder, s.id, { version: 1, volunteerIds: [outside.volunteerId] })).rejects.toMatchObject({ status: 423 }); }
    finally { await db.systemSettings.update({ where: { id: 1 }, data: { lockedBefore: null } }); }
    await TrainingService.add(recorder, s.id, { version: 1, volunteerIds: [outside.volunteerId] });
    expect((await TrainingService.detail(recorder, s.id)).activeCount).toBe(1);
  });
  it('coordinates editing with concurrent additions, never leaving an old snapshot', async () => {
    const s = await TrainingService.create(op(admin), input());
    const results = await Promise.allSettled([
      TrainingService.update(op(admin), s.id, { ...s, version: 1, duration: 4 }),
      TrainingService.add(op(admin), s.id, { version: 1, volunteerIds: [member.volunteerId] }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const current = await db.trainingSession.findUnique({ where: { id: s.id } });
    const rows = await db.projectSupport.findMany({ where: { trainingSessionId: s.id } });
    expect(rows.every((r) => r.duration === current.duration)).toBe(true);
  });
  it('enforces attendance identity in the database itself', async () => {
    const a = await TrainingService.create(op(admin), input()), b = await TrainingService.create(op(admin), input());
    await TrainingService.add(op(admin), a.id, { version: 1, volunteerIds: [member.volunteerId] });
    const record = await db.projectSupport.findFirst({ where: { trainingSessionId: a.id } });
    await expect(db.trainingAttendance.create({ data: { sessionId: b.id, volunteerId: member2.volunteerId, supportId: record.id } })).rejects.toBeDefined();
  });
  it('rolls back a late audit failure after writing an entire attendance batch', async () => {
    const s = await TrainingService.create(op(admin), input());
    // This database trigger runs only after the service has written every member.
    await db.$executeRawUnsafe(`CREATE FUNCTION fail_training_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action::text = 'training_add' THEN RAISE EXCEPTION 'injected late audit failure'; END IF; RETURN NEW; END $$`);
    await db.$executeRawUnsafe('CREATE TRIGGER fail_training_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION fail_training_audit()');
    try {
      await expect(TrainingService.add(op(admin), s.id, { version: 1, volunteerIds: [member.volunteerId, member2.volunteerId] })).rejects.toThrow();
      expect(await db.trainingAttendance.count({ where: { sessionId: s.id } })).toBe(0);
      expect(await db.projectSupport.count({ where: { trainingSessionId: s.id } })).toBe(0);
      expect((await db.trainingSession.findUnique({ where: { id: s.id } })).version).toBe(1);
    } finally {
      await db.$executeRawUnsafe('DROP TRIGGER fail_training_audit ON audit_logs');
      await db.$executeRawUnsafe('DROP FUNCTION fail_training_audit()');
    }
  });
  it('updates actual personal statistics and exports, and rechecks status and locks on restore', async () => {
    const s = await TrainingService.create(op(admin), input());
    const before = (await SupportLedgerService.volunteerDetail(member.volunteerId)).summary;
    await TrainingService.add(op(admin), s.id, { version: 1, volunteerIds: [member.volunteerId] });
    expect((await SupportLedgerService.volunteerDetail(member.volunteerId)).summary.totalHours).toBe(before.totalHours + 2);
    const exported = JSON.parse((await ExportService.exportSupports({ volunteerId: member.volunteerId }, { format: 'json' })).data);
    const support = await db.projectSupport.findFirst({ where: { trainingSessionId: s.id } });
    expect(exported.records.find((r) => r.supportId === support.supportId)?.submittedBy).toBe(admin.name);
    await TrainingService.setRemoved(op(admin), s.id, member.volunteerId, { version: 2 }, true);
    expect((await SupportLedgerService.volunteerDetail(member.volunteerId)).summary).toMatchObject({ totalHours: before.totalHours, totalRecords: before.totalRecords });
    await db.volunteer.update({ where: { id: member.volunteerId }, data: { status: 'INACTIVE' } });
    try { await expect(TrainingService.setRemoved(op(admin), s.id, member.volunteerId, { version: 3 }, false)).rejects.toMatchObject({ status: 400 }); }
    finally { await db.volunteer.update({ where: { id: member.volunteerId }, data: { status: 'ACTIVE' } }); }
    await db.systemSettings.update({ where: { id: 1 }, data: { lockedBefore: new Date('2026-09-02') } });
    try { await expect(TrainingService.setRemoved(op(head), s.id, member.volunteerId, { version: 3 }, false)).rejects.toMatchObject({ status: 423 }); }
    finally { await db.systemSettings.update({ where: { id: 1 }, data: { lockedBefore: null } }); }
    await TrainingService.setRemoved(op(admin), s.id, member.volunteerId, { version: 3 }, false);
    expect((await SupportLedgerService.volunteerDetail(member.volunteerId)).summary.totalHours).toBe(before.totalHours + 2);
    const history = await AuditService.getTargetAuditHistory('TrainingSession', s.id, op(admin));
    expect(history.count).toBe(4); expect(history.history[0].description).toBe('恢复了培训考勤');
    await expect(TrainingService.add(op(member), s.id, { version: 4, volunteerIds: [member2.volunteerId] })).rejects.toMatchObject({ status: 403 });
  });
});

describe.sequential('ordinary tags on real PostgreSQL', () => {
  let group, tag, otherTag, record;
  const supportInput = () => ({ volunteerId: member.volunteerId, serviceItemId: ordinary.id, serviceDate: '2026-09-10', duration: 1, description: `标签原子保存测试 ${++sequence}` });
  it('configures a required single-choice group and rolls back records with missing tags', async () => {
    group = await LabelService.saveGroup(op(admin), null, { name: '笔译岗位', applicability: 'specified', boundServiceItemIds: [ordinary.id], required: true, selectionMode: 'single' });
    tag = await LabelService.saveTag(op(admin), null, { groupId: group.id, name: '初译' });
    otherTag = await LabelService.saveTag(op(admin), null, { groupId: group.id, name: '校对' });
    const before = await db.projectSupport.count();
    const failed = await ProjectSupportService.create(supportInput(), op(member));
    expect(failed.validationError).toContain('必填');
    expect(await db.projectSupport.count()).toBe(before);
    const tooMany = await ProjectSupportService.create({ ...supportInput(), tagIds: [tag.id, otherTag.id] }, op(member));
    expect(tooMany.validationError).toContain('只能选择一个');
    expect(await db.projectSupport.count()).toBe(before);
    record = (await ProjectSupportService.create({ ...supportInput(), tagIds: [tag.id] }, op(admin))).record;
    expect(record.tags.map((t) => t.tagId)).toEqual([tag.id]);
    expect(record.submittedByAccountId).toBe(admin.id);
    expect(record.submittedById).toBeNull();
  });
  it('retains tags on pending proxy records and counts them only after confirmation', async () => {
    const pending = (await ProjectSupportService.create({ ...supportInput(), tagIds: [tag.id] }, op(member2))).record;
    expect(pending.status).toBe('PENDING_CONFIRMATION');
    expect(pending.tags.map((t) => t.tagId)).toEqual([tag.id]);
    const before = await LabelService.detail(op(admin), tag.id);
    expect(before.total).toBe(1);
    await ProjectSupportService.confirm(pending.supportId, op(member));
    const after = await LabelService.detail(op(admin), tag.id);
    expect(after.total).toBe(2); expect(after.people).toBe(1);
  });
  it('prevents removal of the last required tag and replaces single selections atomically', async () => {
    await expect(LabelService.link(op(admin), tag.id, record.id, true)).rejects.toMatchObject({ status: 400 });
    const changed = await LabelService.link(op(admin), otherTag.id, record.id);
    expect(changed.tags.map((t) => t.tagId)).toEqual([otherTag.id]);
    await LabelService.saveGroup(op(admin), group.id, { required: false });
    await LabelService.link(op(admin), otherTag.id, record.id, true);
    expect(await db.projectSupport.findUnique({ where: { id: record.id } })).toMatchObject({ status: 'ACTIVE', duration: 1 });
    await LabelService.link(op(admin), tag.id, record.id);
  });
  it('retains historical out-of-scope associations and denies new ones', async () => {
    const alternate = await db.serviceItem.create({ data: { name: '另一个普通服务', departmentId: 'TRAIN_A', category: 'PROJECT_SUPPORT', displayOrder: 3 } });
    await LabelService.saveGroup(op(admin), group.id, { boundServiceItemIds: [alternate.id] });
    const detail = await LabelService.detail(op(admin), tag.id);
    expect(detail.records.every((r) => r.needsReview)).toBe(true);
    expect(detail.total).toBe(2);
    const fresh = (await ProjectSupportService.create(supportInput(), op(member))).record;
    await expect(LabelService.link(op(admin), tag.id, fresh.id)).rejects.toMatchObject({ status: 400 });
    await LabelService.saveGroup(op(admin), group.id, { boundServiceItemIds: [ordinary.id] });
    const moved = await ProjectSupportService.update(record.supportId, { serviceItemId: alternate.id }, op(admin));
    expect(moved.validationError).toContain('不适用');
    expect((await db.projectSupport.findUnique({ where: { id: record.id } })).serviceItemId).toBe(ordinary.id);
    const explicit = await ProjectSupportService.update(record.supportId, { serviceItemId: alternate.id, tagIds: [] }, op(admin));
    expect(explicit.record.tags).toEqual([]);
  });
  it('enforces department scope and locks on attach/detach, while preserving archive history', async () => {
    const outsideRecord = (await ProjectSupportService.create({ ...supportInput(), volunteerId: outside.volunteerId }, op(admin))).record;
    await expect(LabelService.link(op(head), tag.id, outsideRecord.id)).rejects.toMatchObject({ status: 403 });
    await LabelService.link(op(admin), tag.id, outsideRecord.id);
    await db.systemSettings.update({ where: { id: 1 }, data: { lockedBefore: new Date('2026-09-11') } });
    try { await expect(LabelService.link(op(head), tag.id, record.id, true)).rejects.toMatchObject({ status: 423 }); }
    finally { await db.systemSettings.update({ where: { id: 1 }, data: { lockedBefore: null } }); }
    const before = await db.tagAttachment.count({ where: { tagId: tag.id } });
    await LabelService.saveTag(op(admin), tag.id, { isActive: false });
    expect(await db.tagAttachment.count({ where: { tagId: tag.id } })).toBe(before);
    expect((await LabelService.detail(op(admin), tag.id)).records.every((r) => r.needsReview)).toBe(true);
    await expect(LabelService.link(op(admin), tag.id, outsideRecord.id)).rejects.toMatchObject({ status: 400 });
    await LabelService.saveTag(op(admin), tag.id, { isActive: true });
  });
  it('explicit all scope shows on ordinary forms but never on training attendance', async () => {
    const all = await LabelService.saveGroup(op(admin), null, { name: '通用分类', applicability: 'all', selectionMode: 'multi' });
    expect((await LabelService.bound(ordinary.id)).some((g) => g.id === all.id)).toBe(true);
    expect(await LabelService.bound(item.id)).toEqual([]);
    expect((await LabelService.bound(ordinary.id)).some((g) => g.name === '旧培训')).toBe(false);
  });
  it('serializes concurrent single-choice replacements and preserves historical conflicts', async () => {
    const single = await LabelService.saveGroup(op(admin), null, { name: '并发单选', applicability: 'all' });
    const choices = await Promise.all(['甲', '乙'].map((name) => LabelService.saveTag(op(admin), null, { groupId: single.id, name })));
    const fresh = (await ProjectSupportService.create(supportInput(), op(admin))).record;
    await Promise.all(choices.map((t) => LabelService.link(op(admin), t.id, fresh.id)));
    expect(await db.tagAttachment.count({ where: { supportId: fresh.id, tag: { groupId: single.id } } })).toBe(1);
    await LabelService.saveGroup(op(admin), single.id, { selectionMode: 'multi' });
    await LabelService.replace(op(admin), fresh.id, choices.map((t) => t.id));
    await LabelService.saveGroup(op(admin), single.id, { selectionMode: 'single' });
    expect((await LabelService.detail(op(admin), choices[0].id)).records[0].needsReview).toBe(true);
    expect(await db.tagAttachment.count({ where: { supportId: fresh.id } })).toBe(2);
    await LabelService.link(op(admin), choices[0].id, fresh.id);
    expect(await db.tagAttachment.count({ where: { supportId: fresh.id } })).toBe(1);
    await LabelService.archiveGroup(op(admin), single.id);
    expect((await LabelService.detail(op(admin), choices[0].id)).records[0].needsReview).toBe(true);
  });
});

describe.sequential('training migration and browser', () => {
  it('dry-runs and migrates without changing ledger counts, hours or IDs; reruns are idempotent', async () => {
    const tag = await db.tag.findFirst({ where: { name: '历史培训场次' } });
    const mapping = { sessions: [{ key: `legacy-${tag.id}`, name: '历史培训场次', legacyTagId: tag.id, supportIds: [legacy.id] }] };
    const before = await trainingInventory(db);
    const dry = await migrateTraining(db, mapping, op(admin));
    expect(dry.sessions[0].status).toBe('ready');
    expect(await db.trainingSession.findUnique({ where: { legacyTagId: tag.id } })).toBeNull();
    const applied = await migrateTraining(db, mapping, op(admin), { apply: true });
    expect(applied.sessions[0].status).toBe('migrated');
    expect(await oldDb.projectSupport.findUnique({ where: { id: legacy.id } })).toMatchObject({ supportId: legacy.supportId, duration: legacy.duration, status: legacy.status });
    const after = await trainingInventory(db);
    expect(after.totals).toEqual(before.totals);
    expect(after.summary).toEqual(before.summary);
    expect((await migrateTraining(db, mapping, op(admin), { apply: true })).sessions[0].status).toBe('already_migrated');
    expect((await LabelService.detail(op(admin), tag.id)).trainingSession.id).toBe(applied.sessions[0].sessionId);
    const sessionId = applied.sessions[0].sessionId;
    await TrainingService.add(op(admin), sessionId, { version: 1, volunteerIds: [member2.volunteerId] });
    await TrainingService.setRemoved(op(admin), sessionId, member.volunteerId, { version: 2 }, true);
    const session = await TrainingService.detail(op(admin), sessionId);
    await TrainingService.update(op(admin), sessionId, { ...session, duration: 4 });
    expect((await migrateTraining(db, mapping, op(admin), { apply: true })).sessions[0].status).toBe('already_migrated');
    expect(await db.trainingAttendance.count({ where: { sessionId } })).toBe(2);
  });
  it('rejects ambiguous mappings before writing any part of them', async () => {
    const before = await db.trainingSession.count();
    await expect(migrateTraining(db, { sessions: [{ key: 'bad', name: '重复映射', supportIds: [legacy.id, legacy.id] }] }, op(admin), { apply: true })).rejects.toMatchObject({ status: 400 });
    expect(await db.trainingSession.count()).toBe(before);
  });
  it('rolls back mixed-date mappings and migrates explicitly separated untagged records', async () => {
    const a = await oldDb.projectSupport.create({ data: { supportId: 'PS-UNTAGGED-001', volunteerId: member.volunteerId, submittedById: member.volunteerId, serviceItemId: item.id, serviceDate: new Date('2026-07-01'), duration: 2, description: '无标签历史培训' } });
    const b = await oldDb.projectSupport.create({ data: { supportId: 'PS-UNTAGGED-002', volunteerId: member2.volunteerId, submittedById: member.volunteerId, serviceItemId: item.id, serviceDate: new Date('2026-07-02'), duration: 2, description: '无标签历史培训' } });
    const before = await trainingInventory(db), sessionCount = await db.trainingSession.count();
    await expect(migrateTraining(db, { sessions: [{ key: 'mixed', name: '混合日期', supportIds: [a.id, b.id] }] }, op(admin), { apply: true })).rejects.toMatchObject({ status: 400 });
    expect(await db.trainingSession.count()).toBe(sessionCount);
    const mapping = { sessions: [{ key: 'untagged-a', name: '七月第一场', supportIds: [a.id] }, { key: 'untagged-b', name: '七月第二场', supportIds: [b.id] }] };
    await expect(migrateTraining(db, { sessions: [mapping.sessions[0], { key: 'missing', name: '无效场次', supportIds: ['does-not-exist'] }] }, op(admin), { apply: true })).rejects.toMatchObject({ status: 400 });
    expect(await db.trainingSession.count()).toBe(sessionCount);
    expect((await db.projectSupport.findUnique({ where: { id: a.id } })).trainingSessionId).toBeNull();
    await migrateTraining(db, mapping, op(admin), { apply: true });
    expect((await trainingInventory(db)).totals).toEqual(before.totals);
    expect((await migrateTraining(db, mapping, op(admin), { apply: true })).sessions.every((s) => s.status === 'already_migrated')).toBe(true);
  });
  it('restores a complete database backup into a separate database and verifies the ledger', async () => {
    const container = process.env.TRAINING_TEST_CONTAINER;
    const dump = execFileSync('docker', ['exec', container, 'pg_dump', '-U', 'forum_test', '-d', 'forum_test', '-Fc']);
    execFileSync('docker', ['exec', container, 'createdb', '-U', 'forum_test', 'training_restore']);
    execFileSync('docker', ['exec', '-i', container, 'pg_restore', '-U', 'forum_test', '-d', 'training_restore', '--exit-on-error'], { input: dump });
    const { PrismaClient } = await import(pathToFileURL(`${process.env.TRAINING_TEST_WORKDIR}/new-client/index.js`).href);
    const url = new URL(process.env.DATABASE_URL); url.pathname = '/training_restore';
    const restored = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    try {
      expect((await trainingInventory(restored)).totals).toEqual((await trainingInventory(db)).totals);
      expect(await restored.trainingAttendance.count()).toBe(await db.trainingAttendance.count());
      expect(await restored.trainingSession.count()).toBe(await db.trainingSession.count());
    } finally { await restored.$disconnect(); }
  });
  it('authenticates training HTTP routes and retires every legacy batch write operation', async () => {
    const server = await new Promise((resolve) => { const running = app.listen(0, '127.0.0.1', () => resolve(running)); });
    const url = `http://127.0.0.1:${server.address().port}/api/v1`;
    const authorization = (account) => ({ Authorization: `Bearer ${jwt.sign({ sub: account.id }, process.env.JWT_SECRET, { expiresIn: '5m' })}` });
    try {
      expect((await fetch(`${url}/training`)).status).toBe(401);
      expect((await fetch(`${url}/training`, { headers: authorization(member) })).status).toBe(403);
      const allowed = await fetch(`${url}/training`, { headers: authorization(admin) });
      expect(allowed.status).toBe(200); expect(allowed.headers.get('cache-control')).toContain('no-store');
      for (const operation of ['create', 'update', 'delete', 'attach', 'detach']) {
        expect((await fetch(`${url}/tags/legacy/batch/${operation}`, { method: 'POST', headers: authorization(admin) })).status).toBe(410);
      }
    } finally { await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }); }
  });
  it.runIf(process.env.TRAINING_E2E === '1')('runs desktop and mobile browser workflows', async () => {
    await runTrainingBrowser(app);
  }, 180000);
});
