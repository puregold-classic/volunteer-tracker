import prisma from '../utils/prismaClient.js';
import IDGenerator from '../utils/IDGenerator.js';
import { LedgerError, requireLedgerManager, volunteerScope, canManageVolunteer, businessDate, assertUnlocked, ledgerTransaction } from '../utils/ledgerPolicy.js';

const personSelect = { id: true, volunteerCode: true, chineseName: true, englishName: true, departmentId: true, department: { select: { name: true } }, status: true };
const sessionInclude = { serviceItem: { include: { department: true } } };
const publicPerson = (v) => ({ id: v.id, volunteerCode: v.volunteerCode, chineseName: v.chineseName, englishName: v.englishName, departmentId: v.departmentId, departmentName: v.department?.name });
const pageArgs = (query) => ({ take: Math.min(100, Math.max(1, Math.trunc(Number(query.limit)) || 30)), skip: Math.max(0, (Math.trunc(Number(query.page)) || 1) - 1) * Math.min(100, Math.max(1, Math.trunc(Number(query.limit)) || 30)) });
const day = (date) => date.toISOString().slice(0, 10);
const pack = (s) => ({ ...s, serviceDate: day(s.serviceDate) });

export function parseTrainingNames(text) {
  if (typeof text !== 'string' || text.length > 50000) throw new LedgerError(400, '名单格式无效或过长');
  const names = text.split(/[\n,，、;；\t]/).map((x) => x.trim()).filter(Boolean);
  if (names.length > 500) throw new LedgerError(400, '单次最多 500 个姓名，请拆分录入');
  return names;
}

async function audit(tx, action, session, op, details = {}, changes = []) {
  const identity = { id: op.accountId, volunteerId: op.volunteerId ?? null, role: op.role, name: op.name ?? null };
  await tx.auditLog.create({ data: { auditId: IDGenerator.generateAuditId(), targetType: 'TrainingSession', targetId: session.id, action,
    actionDetails: { sessionName: session.name, ...details }, changes, operator: identity, submitter: identity } });
}
function sessionVisibility(op) {
  if (op.role !== 'a_admin') return {};
  return { OR: [{ departmentId: null }, { departmentId: op.departmentId }, { attendances: { some: { volunteer: volunteerScope(op) } } }] };
}
async function loadSession(tx, id, op) {
  const session = await tx.trainingSession.findFirst({ where: { id, ...sessionVisibility(op) }, include: sessionInclude });
  if (!session) throw new LedgerError(404, '场次不存在或不在可管理范围内');
  return session;
}
async function sessionFields(tx, input) {
  const name = String(input.name || '').trim(), description = String(input.description || '').trim();
  if (!name || name.length > 120) throw new LedgerError(400, '培训名称须为 1–120 字');
  if (description.length < 5 || description.length > 1000) throw new LedgerError(400, '培训内容须为 5–1000 字');
  if (typeof input.duration !== 'number' || !Number.isFinite(input.duration) || input.duration <= 0 || input.duration % 0.5) throw new LedgerError(400, '时长须为大于 0 的 0.5 小时倍数');
  const serviceDate = businessDate(input.serviceDate);
  const item = await tx.serviceItem.findUnique({ where: { id: String(input.serviceItemId || '') } });
  if (!item?.isActive || item.category !== 'TRAINING_ATTENDANCE') throw new LedgerError(400, '请选择有效的受训服务项');
  return { name, description, serviceDate, duration: input.duration, serviceItemId: item.id };
}
async function checkVersion(tx, session, version, op) {
  if (!Number.isInteger(version) || version !== session.version) throw new LedgerError(409, '场次或名单已更新，请刷新后重试；已输入的内容会保留');
  const updated = await tx.trainingSession.updateMany({ where: { id: session.id, version }, data: { version: { increment: 1 }, updatedByAccountId: op.accountId } });
  if (!updated.count) throw new LedgerError(409, '场次已更新，请刷新后重试');
}
async function wholeSessionPermission(tx, session, op) {
  if (op.role !== 'a_admin') return;
  const outside = await tx.trainingAttendance.count({ where: { sessionId: session.id, removedAt: null, volunteer: { departmentId: { not: op.departmentId } } } });
  if (outside || (session.departmentId !== op.departmentId && !await tx.trainingAttendance.count({ where: { sessionId: session.id, removedAt: null } }))) {
    throw new LedgerError(403, '整场修改需要管理全部有效参加人员；请联系全局录入员或系统管理员');
  }
}

class TrainingService {
  static async list(op, query = {}) {
    requireLedgerManager(op);
    const where = { ...sessionVisibility(op), ...(query.search ? { name: { contains: String(query.search), mode: 'insensitive' } } : {}),
      ...(query.from || query.to ? { serviceDate: { ...(query.from ? { gte: businessDate(query.from) } : {}), ...(query.to ? { lte: businessDate(query.to) } : {}) } } : {}) };
    const [rows, total] = await Promise.all([prisma.trainingSession.findMany({ where, ...pageArgs(query), orderBy: [{ serviceDate: 'desc' }, { id: 'asc' }], include: { ...sessionInclude,
      _count: { select: { attendances: { where: { removedAt: null, volunteer: volunteerScope(op) } } } } } }), prisma.trainingSession.count({ where })]);
    return { items: rows.map((r) => ({ ...pack(r), activeCount: r._count.attendances })), total, scoped: op.role === 'a_admin' };
  }
  static async detail(op, id, query = {}) {
    requireLedgerManager(op);
    const session = await loadSession(prisma, id, op);
    const scope = { sessionId: id, volunteer: volunteerScope(op) };
    const where = { ...scope, ...(query.removed === 'true' ? { removedAt: { not: null } } : { removedAt: null }),
      ...(query.search ? { volunteer: { ...volunteerScope(op), OR: ['chineseName', 'englishName', 'volunteerCode'].map((f) => ({ [f]: { contains: String(query.search), mode: 'insensitive' } })) } } : {}) };
    const [members, total, activeCount, removedCount] = await Promise.all([
      prisma.trainingAttendance.findMany({ where, ...pageArgs(query), orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], include: { volunteer: { select: personSelect }, support: { select: { supportId: true, status: true } } } }),
      prisma.trainingAttendance.count({ where }), prisma.trainingAttendance.count({ where: { ...scope, removedAt: null } }), prisma.trainingAttendance.count({ where: { ...scope, removedAt: { not: null } } }),
    ]);
    let canEdit = true;
    try { await wholeSessionPermission(prisma, session, op); } catch { canEdit = false; }
    return { ...pack(session), members: members.map((m) => ({ ...m, volunteer: publicPerson(m.volunteer) })), total, activeCount, removedCount, canEdit, scoped: op.role === 'a_admin' };
  }
  static async create(op, input) {
    requireLedgerManager(op);
    return ledgerTransaction(prisma, async (tx) => {
      const data = await sessionFields(tx, input);
      await assertUnlocked(tx, op, data.serviceDate);
      const session = await tx.trainingSession.create({ data: { ...data, departmentId: op.role === 'a_admin' ? op.departmentId : null, createdByAccountId: op.accountId, updatedByAccountId: op.accountId }, include: sessionInclude });
      await audit(tx, 'training_create', session, op);
      return pack(session);
    });
  }
  static async update(op, id, input) {
    requireLedgerManager(op);
    return ledgerTransaction(prisma, async (tx) => {
      const session = await loadSession(tx, id, op);
      await wholeSessionPermission(tx, session, op);
      const data = await sessionFields(tx, input);
      await assertUnlocked(tx, op, session.serviceDate, data.serviceDate);
      await checkVersion(tx, session, input.version, op);
      const { name, ...snapshot } = data;
      const records = await tx.projectSupport.updateMany({ where: { trainingSessionId: id, status: 'ACTIVE' }, data: snapshot });
      const updated = await tx.trainingSession.update({ where: { id }, data, include: sessionInclude });
      const changes = Object.keys(data).filter((k) => String(data[k]) !== String(session[k])).map((field) => ({ field, from: session[field], to: data[field] }));
      await audit(tx, 'training_update', updated, op, { affectedCount: records.count, adminCorrection: op.role === 'admin' }, JSON.parse(JSON.stringify(changes)));
      return { ...pack(updated), affectedCount: records.count };
    });
  }
  static async search(op, id, query = {}) {
    requireLedgerManager(op);
    await loadSession(prisma, id, op);
    if (!String(query.search || '').trim()) return [];
    const people = await prisma.volunteer.findMany({ where: { status: 'ACTIVE', ...volunteerScope(op), OR: ['chineseName', 'englishName', 'volunteerCode'].map((f) => ({ [f]: { contains: String(query.search).trim(), mode: 'insensitive' } })) }, take: 30, orderBy: { volunteerCode: 'asc' }, select: personSelect });
    const existing = await prisma.trainingAttendance.findMany({ where: { sessionId: id, volunteerId: { in: people.map((p) => p.id) } } });
    const byId = new Map(existing.map((a) => [a.volunteerId, a]));
    return people.map((p) => ({ ...publicPerson(p), state: !byId.has(p.id) ? 'new' : byId.get(p.id).removedAt ? 'removed' : 'existing' }));
  }
  static async validate(op, id, input) {
    requireLedgerManager(op);
    const session = await loadSession(prisma, id, op);
    const names = parseTrainingNames(input.text);
    const tokens = [...new Set(names)];
    const people = tokens.length ? await prisma.volunteer.findMany({ where: { status: 'ACTIVE', ...volunteerScope(op), OR: tokens.flatMap((token) => ['volunteerCode', 'chineseName', 'englishName'].map((field) => ({ [field]: { equals: token, mode: 'insensitive' } }))) }, select: personSelect }) : [];
    const existing = await prisma.trainingAttendance.findMany({ where: { sessionId: id, volunteerId: { in: people.map((p) => p.id) } } });
    const byId = new Map(existing.map((a) => [a.volunteerId, a]));
    const seen = new Set();
    const rows = names.map((raw, index) => {
      const key = raw.toLowerCase();
      let candidates = [];
      for (const field of ['volunteerCode', 'chineseName', 'englishName']) {
        candidates = people.filter((p) => p[field]?.toLowerCase() === key);
        if (candidates.length) break;
      }
      const choice = input.choices?.[index];
      if (choice) candidates = candidates.filter((p) => p.id === choice);
      if (!candidates.length) return { index, input: raw, state: 'unmatched', reason: '未找到可录入人员，请核对姓名、在职状态及管理范围' };
      if (candidates.length > 1) return { index, input: raw, state: 'ambiguous', candidates: candidates.map(publicPerson) };
      const volunteer = publicPerson(candidates[0]), old = byId.get(volunteer.id);
      const state = seen.has(volunteer.id) ? 'duplicate' : old ? (old.removedAt ? 'removed' : 'existing') : 'new';
      seen.add(volunteer.id);
      return { index, input: raw, state, volunteer };
    });
    return { version: session.version, rows };
  }
  static async add(op, id, input) {
    requireLedgerManager(op);
    if (!Array.isArray(input.volunteerIds) || !input.volunteerIds.length || input.volunteerIds.length > 500 || input.volunteerIds.some((v) => typeof v !== 'string')) throw new LedgerError(400, '请选择 1–500 名参加人员');
    const ids = [...new Set(input.volunteerIds)];
    return ledgerTransaction(prisma, async (tx) => {
      const session = await loadSession(tx, id, op);
      await assertUnlocked(tx, op, session.serviceDate);
      if (!session.serviceItem.isActive) throw new LedgerError(400, '该受训服务项已停用，请先调整场次类型');
      await checkVersion(tx, session, input.version, op);
      const volunteers = await tx.volunteer.findMany({ where: { id: { in: ids }, status: 'ACTIVE', ...volunteerScope(op) }, select: personSelect });
      if (volunteers.length !== ids.length) throw new LedgerError(403, '部分人员已停用或不在管理范围内，请重新校验名单');
      const old = await tx.trainingAttendance.findMany({ where: { sessionId: id, volunteerId: { in: ids } } });
      const byId = new Map(old.map((a) => [a.volunteerId, a]));
      const created = [], skipped = [], removed = [];
      for (const volunteer of volunteers.sort((a, b) => a.id.localeCompare(b.id))) {
        const previous = byId.get(volunteer.id);
        if (previous) { (previous.removedAt ? removed : skipped).push(volunteer.id); continue; }
        const supportId = await IDGenerator.generateSupportId(volunteer.volunteerCode, tx);
        const record = await tx.projectSupport.create({ data: { supportId, volunteerId: volunteer.id, submittedById: op.volunteerId ?? null, submittedByAccountId: op.accountId,
          trainingSessionId: id, serviceItemId: session.serviceItemId, serviceDate: session.serviceDate, duration: session.duration, description: session.description, status: 'ACTIVE', confirmedAt: new Date() } });
        await tx.trainingAttendance.create({ data: { sessionId: id, volunteerId: volunteer.id, supportId: record.id } });
        created.push(volunteer.id);
      }
      await audit(tx, 'training_add', session, op, { created, skipped, removed, adminCorrection: op.role === 'admin' });
      return { created, skipped, removed, version: session.version + 1 };
    });
  }
  static async setRemoved(op, id, volunteerId, input, removed) {
    requireLedgerManager(op);
    return ledgerTransaction(prisma, async (tx) => {
      const session = await loadSession(tx, id, op);
      const attendance = await tx.trainingAttendance.findUnique({ where: { sessionId_volunteerId: { sessionId: id, volunteerId } }, include: { volunteer: true, support: true } });
      if (!attendance || !canManageVolunteer(op, attendance.volunteer)) throw new LedgerError(404, '参加记录不存在或不在管理范围');
      await assertUnlocked(tx, op, session.serviceDate, attendance.support.serviceDate);
      if (!removed && (attendance.volunteer.status !== 'ACTIVE' || !session.serviceItem.isActive)) throw new LedgerError(400, '人员或受训服务项已停用，不能恢复');
      await checkVersion(tx, session, input.version, op);
      await tx.trainingAttendance.update({ where: { id: attendance.id }, data: { removedAt: removed ? new Date() : null } });
      await tx.projectSupport.update({ where: { id: attendance.supportId }, data: { status: removed ? 'DELETED' : 'ACTIVE', ...(!removed ? { serviceDate: session.serviceDate, duration: session.duration, description: session.description, serviceItemId: session.serviceItemId, confirmedAt: new Date() } : {}) } });
      await audit(tx, removed ? 'training_remove' : 'training_restore', session, op, { volunteerId, supportId: attendance.support.supportId, adminCorrection: op.role === 'admin' });
      return { version: session.version + 1 };
    });
  }
}
export default TrainingService;
