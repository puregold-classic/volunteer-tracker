import prisma from '../utils/prismaClient.js';
import { buildForumAccess, getForumAccess } from '../utils/forumPermissions.js';
import { FORUM_AUTHOR_SELECT, serializeForumAuthor } from '../utils/forumIdentity.js';
import IDGenerator from '../utils/IDGenerator.js';

export class ForumError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const requirePermission = (allowed) => { if (!allowed) throw new ForumError(403, '没有此圈务操作权限'); };
const textField = (value, label, max, optional = false) => {
  if (typeof value !== 'string') throw new ForumError(400, `${label}格式不正确`);
  const normalized = value.trim();
  if ((!optional && !normalized) || [...normalized].length > max) throw new ForumError(400, `${label}${optional ? '' : '不能为空，且'}最多 ${max} 字`);
  return normalized;
};
const slugField = (value) => {
  const slug = textField(value, '圈子地址', 64);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new ForumError(400, '圈子地址只能包含小写字母、数字和中间的连字符');
  return slug;
};
const include = (accountId) => ({
  assets: { where: { kind: 'COVER', deletedAt: null }, select: { id: true }, take: 1 },
  follows: { where: { accountId }, select: { accountId: true } },
  roles: { orderBy: { addedAt: 'asc' }, include: { account: { select: { ...FORUM_AUTHOR_SELECT, isActive: true } } } },
  _count: { select: { posts: { where: { status: 'ACTIVE' } } } },
});
const serialize = (circle, actor) => ({
  id: circle.id, slug: circle.slug, name: circle.name, description: circle.description,
  status: circle.status, archivedAt: circle.archivedAt, createdAt: circle.createdAt,
  coverId: circle.assets?.[0]?.id ?? null,
  postCount: circle._count.posts, isFollowing: Boolean(circle.follows?.length),
  roles: circle.roles.map((assignment) => ({ role: assignment.role, account: { ...serializeForumAuthor(assignment.account), isActive: assignment.account.isActive } })),
  needsOwner: !circle.roles.some((assignment) => assignment.role === 'OWNER' && assignment.account.isActive),
  capabilities: buildForumAccess(actor, { ...circle, roles: circle.roles.filter((assignment) => assignment.accountId === actor.id) }),
});
const actorFor = async (operator, db = prisma) => {
  const actor = operator?.accountId ? await db.account.findUnique({ where: { id: operator.accountId }, select: { id: true, name: true, role: true, isActive: true } }) : null;
  if (!actor?.isActive) throw new ForumError(401, '请先登录');
  return actor;
};
const transaction = async (work) => {
  for (let attempt = 0; ; attempt += 1) {
    try { return await prisma.$transaction(work, { isolationLevel: 'Serializable' }); }
    catch (error) {
      if (error.code === 'P2034' && attempt < 3) continue;
      if (error.code === 'P2002') throw new ForumError(409, '圈子地址或圈务身份已存在');
      if (['P2034', 'P2003', 'P2025'].includes(error.code)) throw new ForumError(409, '资料已发生变化，请刷新后重试');
      throw error;
    }
  }
};
const writeAudit = async (tx, actor, circleId, action, details = {}) => {
  const identity = { id: actor.id, name: actor.name, role: actor.role };
  return tx.auditLog.create({ data: {
    auditId: IDGenerator.generateAuditId(), targetType: 'Circle', targetId: circleId, action,
    actionDetails: details, operator: identity, submitter: identity,
  } });
};
const notifyRole = async (tx, audit, actor, recipientId, circleId, type) => {
  if (recipientId === actor.id) return;
  await tx.notification.create({ data: { recipientId, actorId: actor.id, type, eventKey: audit.id,
    targetType: 'Circle', targetId: circleId, circleId } });
};
const activeTarget = async (tx, accountId) => {
  if (typeof accountId !== 'string' || !accountId) throw new ForumError(400, '请选择有效账号');
  const target = await tx.account.findUnique({ where: { id: accountId }, select: { id: true, isActive: true } });
  if (!target?.isActive) throw new ForumError(400, '所选账号不存在或已停用');
  return target;
};
const mutate = (operator, circleId, permission, work) => transaction(async (tx) => {
  const actor = await actorFor(operator, tx);
  const access = await getForumAccess(operator, circleId, tx);
  if (!access.circleId) throw new ForumError(404, '圈子不存在');
  requirePermission(access[permission]);
  await work(tx, actor, access);
  return serialize(await tx.circle.findUnique({ where: { id: circleId }, include: include(actor.id) }), actor);
});

class CircleService {
  static async list(operator, { view = 'active' } = {}) {
    const actor = await actorFor(operator);
    if (!['active', 'manage'].includes(view)) throw new ForumError(400, '无效的圈子视图');
    const where = view === 'manage'
      ? (actor.role === 'admin' ? {} : { roles: { some: { accountId: actor.id } } })
      : { status: 'ACTIVE' };
    const circles = await prisma.circle.findMany({ where, include: include(actor.id), orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    return { circles: circles.map((c) => serialize(c, actor)), canCreateCircle: actor.role === 'admin' };
  }

  static async get(operator, key, { management = false, byId = false } = {}) {
    const actor = await actorFor(operator);
    const circle = await prisma.circle.findUnique({ where: byId ? { id: key } : { slug: key }, include: include(actor.id) });
    if (!circle) throw new ForumError(404, '圈子不存在');
    const result = serialize(circle, actor);
    if (management) requirePermission(result.capabilities.canViewManagement);
    else if (circle.status !== 'ACTIVE') throw new ForumError(410, '圈子已归档');
    return result;
  }

  static async create(operator, input = {}) {
    return transaction(async (tx) => {
      const actor = await actorFor(operator, tx);
      requirePermission(actor.role === 'admin');
      const name = textField(input.name, '圈名', 40);
      const slug = slugField(input.slug);
      const description = textField(input.description ?? '', '简介', 500, true);
      if (!Array.isArray(input.ownerIds) || !input.ownerIds.length || input.ownerIds.length > 20) throw new ForumError(400, '请指定 1 至 20 位圈主');
      const ownerIds = [...new Set(input.ownerIds)];
      for (const id of ownerIds) await activeTarget(tx, id);
      const circle = await tx.circle.create({ data: { name, slug, description, createdById: actor.id,
        roles: { create: ownerIds.map((accountId) => ({ accountId, role: 'OWNER' })) } } });
      const audit = await writeAudit(tx, actor, circle.id, 'circle_create', { name, slug, ownerIds });
      for (const id of ownerIds) await notifyRole(tx, audit, actor, id, circle.id, 'CIRCLE_ROLE_ASSIGNED');
      return serialize(await tx.circle.findUnique({ where: { id: circle.id }, include: include(actor.id) }), actor);
    });
  }

  static update(operator, circleId, input = {}) {
    return mutate(operator, circleId, 'canEditCircle', async (tx, actor, access) => {
      const data = {};
      if (input.name !== undefined) data.name = textField(input.name, '圈名', 40);
      if (input.description !== undefined) data.description = textField(input.description, '简介', 500, true);
      if (input.slug !== undefined) { requirePermission(access.canChangeSlug); data.slug = slugField(input.slug); }
      if (!Object.keys(data).length) throw new ForumError(400, '没有可修改的字段');
      const old = await tx.circle.findUnique({ where: { id: circleId } });
      if (Object.entries(data).every(([key, value]) => old[key] === value)) return;
      await tx.circle.update({ where: { id: circleId }, data });
      await writeAudit(tx, actor, circleId, 'circle_update', { before: { name: old.name, description: old.description, slug: old.slug }, after: data });
    });
  }

  static setArchived(operator, circleId, archived) {
    // System admins can repeat the same archive/restore request idempotently.
    return mutate(operator, circleId, 'canManageOwners', async (tx, actor) => {
      const old = await tx.circle.findUnique({ where: { id: circleId } });
      const status = archived ? 'ARCHIVED' : 'ACTIVE';
      if (old.status === status) return;
      await tx.circle.update({ where: { id: circleId }, data: { status, archivedAt: archived ? new Date() : null } });
      if (archived) await tx.notification.deleteMany({ where: { circleId, type: { in: ['POST_COMMENT', 'MENTION'] } } });
      await writeAudit(tx, actor, circleId, archived ? 'circle_archive' : 'circle_restore');
    });
  }

  static setRole(operator, circleId, accountId, role, remove = false) {
    if (!['OWNER', 'STEWARD'].includes(role)) throw new ForumError(400, '无效的圈务身份');
    return mutate(operator, circleId, role === 'OWNER' ? 'canManageOwners' : 'canManageStewards', async (tx, actor) => {
      const key = { circleId_accountId: { circleId, accountId } };
      const existing = await tx.circleRoleAssignment.findUnique({ where: key });
      if (existing?.role === 'OWNER' && role === 'STEWARD') throw new ForumError(409, '请通过圈主操作管理该成员');
      if (remove) {
        if (!existing) return;
        if (existing.role !== role) throw new ForumError(409, '圈务身份已变化，请刷新');
        await tx.circleRoleAssignment.delete({ where: key });
      } else {
        await activeTarget(tx, accountId);
        if (existing?.role === role) return;
        await tx.circleRoleAssignment.upsert({ where: key, create: { circleId, accountId, role }, update: { role } });
      }
      // All role changes write their circle, serializing them against archival.
      await tx.circle.update({ where: { id: circleId }, data: { updatedAt: new Date() } });
      const audit = await writeAudit(tx, actor, circleId, remove ? 'circle_role_remove' : 'circle_role_assign', { accountId, role, previousRole: existing?.role ?? null });
      await notifyRole(tx, audit, actor, accountId, circleId, remove ? 'CIRCLE_ROLE_REMOVED' : 'CIRCLE_ROLE_ASSIGNED');
    });
  }

  static transfer(operator, circleId, input = {}) {
    return mutate(operator, circleId, 'canTransferOwnership', async (tx, actor, access) => {
      const sourceId = input.fromAccountId ?? actor.id;
      if (typeof sourceId !== 'string' || !sourceId) throw new ForumError(400, '原圈主账号格式不正确');
      if (sourceId !== actor.id) requirePermission(access.isSystemAdmin);
      const targetId = input.toAccountId;
      if (sourceId === targetId) throw new ForumError(400, '不能转让给自己');
      await activeTarget(tx, targetId);
      const source = await tx.circleRoleAssignment.findUnique({ where: { circleId_accountId: { circleId, accountId: sourceId } } });
      if (source?.role !== 'OWNER') throw new ForumError(409, '原圈主身份已变化，请刷新');
      await tx.circleRoleAssignment.upsert({ where: { circleId_accountId: { circleId, accountId: targetId } }, create: { circleId, accountId: targetId, role: 'OWNER' }, update: { role: 'OWNER' } });
      await tx.circleRoleAssignment.delete({ where: { circleId_accountId: { circleId, accountId: sourceId } } });
      await tx.circle.update({ where: { id: circleId }, data: { updatedAt: new Date() } });
      const audit = await writeAudit(tx, actor, circleId, 'circle_ownership_transfer', { fromAccountId: sourceId, toAccountId: targetId });
      await notifyRole(tx, audit, actor, targetId, circleId, 'CIRCLE_OWNERSHIP_TRANSFERRED');
      await notifyRole(tx, audit, actor, sourceId, circleId, 'CIRCLE_ROLE_REMOVED');
    });
  }

  static async candidates(operator, { circleId, search = '' } = {}) {
    const access = await getForumAccess(operator, circleId);
    if (!access.isAuthenticated) throw new ForumError(401, '请先登录');
    requirePermission(circleId ? access.canManageStewards || access.canTransferOwnership : access.canCreateCircle);
    const query = textField(search, '搜索', 100, true);
    const rows = await prisma.account.findMany({ where: { isActive: true, ...(query ? { OR: [
      { name: { contains: query, mode: 'insensitive' } },
      { volunteer: { chineseName: { contains: query, mode: 'insensitive' } } },
      { volunteer: { volunteerCode: { contains: query, mode: 'insensitive' } } },
    ] } : {}) }, select: { ...FORUM_AUTHOR_SELECT, volunteer: { select: { ...FORUM_AUTHOR_SELECT.volunteer.select, volunteerCode: true } } }, orderBy: [{ name: 'asc' }, { id: 'asc' }], take: 20 });
    return rows.map((a) => ({ ...serializeForumAuthor(a), volunteerCode: a.volunteer?.volunteerCode ?? null }));
  }
}
export default CircleService;
