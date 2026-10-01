import { registerDirectoryTests } from './directoryCases.js';
import { registerCommentInteractionTests } from './commentInteractionCases.js';
import { registerAssetMentionTests } from './assetMentionCases.js';
import { registerInteractionTests } from './interactionCases.js';
import { registerRichContentTests } from './richContentCases.js';
import { registerNotificationTests } from './notificationCases.js';
import { registerPostTests } from './postCases.js';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

vi.mock('../src/utils/prismaClient.js', async () => {
  const { pathToFileURL } = await import('node:url');
  const { PrismaClient } = await import(pathToFileURL(`${process.env.FORUM_TEST_WORKDIR}/new-client/index.js`).href);
  return { default: new PrismaClient() };
});

import db from '../src/utils/prismaClient.js';
import { createAdminAccount, createVolunteerAccount, deleteAccount } from '../src/services/AccountService.js';
import { resetToSystemAdmin } from '../src/services/AdminService.js';
import { getForumAccess, getContentPermissions } from '../src/utils/forumPermissions.js';
import { FORUM_AUTHOR_SELECT, serializeForumAuthor } from '../src/utils/forumIdentity.js';
import AuditService from '../src/services/AuditService.js';
import IDGenerator from '../src/utils/IDGenerator.js';
import CircleService from '../src/services/CircleService.js';
import { createNewcomerCircleIfMissing } from '../src/startup/createNewcomerCircle.js';
import { runForumBrowser } from './runForumBrowser.js';
import { app } from '../src/server.js';

let admin;
let legacyUser;
let legacySupport;
let oldDb;
let seq = 0;
const user = async (role = 'user', email = null) => {
  seq += 1;
  const result = await createVolunteerAccount({
    volunteer: { chineseName: `论坛用户${seq}`, departmentId: 'FORUM_TEST', region: '其他' },
    account: { email: email || `forum-${seq}@example.test`, password: 'TestOnly@123', role },
  });
  expect(result.account, JSON.stringify(result)).toBeDefined();
  return result.account;
};
const circle = async () => db.circle.create({ data: { slug: `circle-${++seq}`, name: '测试圈', createdById: admin.id } });
const post = async (c, authorId) => db.post.create({ data: { circleId: c.id, authorId, title: '保留历史', body: '帖子正文' } });
const notification = async (c, p, recipientId, actorId) => db.notification.create({ data: {
  recipientId, actorId, type: 'POST_COMMENT', eventKey: `reply-${++seq}`,
  targetType: 'Post', targetId: p.id, postId: p.id, circleId: c.id,
} });
const audit = async (targetType, action, targetId) => db.auditLog.create({ data: {
  auditId: IDGenerator.generateAuditId(), targetType, action, targetId,
  actionDetails: { test: true }, operator: { id: admin.id }, submitter: { id: admin.id },
} });

beforeAll(async () => {
  const { PrismaClient } = await import(pathToFileURL(path.join(process.env.FORUM_TEST_WORKDIR, 'old-client/index.js')).href);
  oldDb = new PrismaClient();
  // Runner has applied only the pre-forum migrations. These are real legacy
  // records created through the application's canonical AccountService.
  await db.department.create({ data: { id: 'FORUM_TEST', name: '测试部门', displayOrder: 1 } });
  admin = (await createAdminAccount({ email: 'admin@example.test', password: 'TestOnly@123', name: '系统管理员' })).account;
  legacyUser = await user();
  const item = await db.serviceItem.create({ data: { departmentId: 'FORUM_TEST', name: '测试服务', category: 'PROJECT_SUPPORT', displayOrder: 1 } });
  legacySupport = await oldDb.projectSupport.create({ data: {
    supportId: 'PS-LEGACY-001', volunteerId: legacyUser.volunteerId, submittedById: legacyUser.volunteerId,
    serviceItemId: item.id, serviceDate: new Date('2026-09-01T00:00:00Z'), duration: 2, description: '升级前台账',
  } });
  await audit('Account', 'account_create', legacyUser.id);

  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema', path.join(process.env.FORUM_TEST_WORKDIR, 'after/schema.prisma')], { env: process.env, stdio: 'pipe', timeout: 60_000 });
});

afterAll(async () => {
  await db.$disconnect();
  await oldDb?.$disconnect();
});

describe.sequential('forum foundation on PostgreSQL 16', () => {
  it('upgrades existing data, preserving account/volunteer identity and ledger rows', async () => {
    expect(await db.account.findUnique({ where: { id: legacyUser.id } })).toMatchObject({ volunteerId: legacyUser.volunteerId });
    expect(await db.projectSupport.findUnique({ where: { id: legacySupport.id } })).toMatchObject(legacySupport);
    // The old generated client can still read/write its existing business tables.
    expect(await oldDb.account.findUnique({ where: { id: admin.id } })).toMatchObject({ role: 'admin', volunteerId: null });
    await oldDb.volunteer.update({ where: { id: legacyUser.volunteerId }, data: { bio: '旧客户端写入' } });
    expect(await db.volunteer.findUnique({ where: { id: legacyUser.volunteerId } })).toMatchObject({ bio: '旧客户端写入' });
    expect(await oldDb.projectSupport.findUnique({ where: { id: legacySupport.id } })).toEqual(legacySupport);
    const constraints = await db.$queryRaw`SELECT conname FROM pg_constraint WHERE conrelid = 'accounts'::regclass AND contype = 'c'`;
    expect(constraints.length).toBeGreaterThan(0);
    const indexes = await db.$queryRaw`SELECT indexdef FROM pg_indexes WHERE tablename = 'project_supports'`;
    expect(indexes.some((r) => r.indexdef.includes('UNIQUE') && r.indexdef.includes('WHERE'))).toBe(true);
  });

  it('lets a pure admin participate without inventing a volunteer identity', async () => {
    const c = await circle();
    const p = await post(c, admin.id);
    await db.postComment.create({ data: { postId: p.id, authorId: admin.id, body: '管理员回复' } });
    await db.postLike.create({ data: { postId: p.id, accountId: admin.id } });
    await db.postFavorite.create({ data: { postId: p.id, accountId: admin.id } });
    const access = await getForumAccess({ accountId: admin.id }, c.id, db);
    expect(access).toMatchObject({ canParticipate: true, canManageOwners: true, canArchiveCircle: true });
    expect(serializeForumAuthor(await db.account.findUnique({ where: { id: admin.id }, select: FORUM_AUTHOR_SELECT }))).toMatchObject({ volunteerId: null, name: '系统管理员' });
  });

  it('enforces actual circle membership independently of ledger roles and prevents cross-circle access', async () => {
    const c = await circle();
    const other = await circle();
    for (const role of ['user', 'a_admin', 'b_admin']) {
      const a = await user(role);
      expect((await getForumAccess({ accountId: a.id, role: 'admin' }, c.id, db)).canModerate).toBe(false);
      await db.circleRoleAssignment.create({ data: { circleId: c.id, accountId: a.id, role: 'STEWARD' } });
      const access = await getForumAccess({ accountId: a.id }, c.id, db);
      expect(access.canModerate).toBe(true);
      expect((await getForumAccess({ accountId: a.id }, other.id, db)).canModerate).toBe(false);
      await db.account.update({ where: { id: a.id }, data: { isActive: false } });
      expect((await getForumAccess({ accountId: a.id }, c.id, db)).canRead).toBe(false);
    }
  });

  it('account deletion anonymizes authors/actors/likes and removes only personal data', async () => {
    const a = await user();
    const c = await db.circle.create({ data: { slug: `owned-${++seq}`, name: '注销者的圈子', createdById: a.id } });
    const p = await post(c, a.id);
    const comment = await db.postComment.create({ data: { postId: p.id, authorId: a.id, body: '历史回复' } });
    await db.circleRoleAssignment.create({ data: { circleId: c.id, accountId: a.id, role: 'OWNER' } });
    await db.circleFollow.create({ data: { circleId: c.id, accountId: a.id } });
    await db.postFavorite.create({ data: { postId: p.id, accountId: a.id } });
    await db.postLike.create({ data: { postId: p.id, accountId: a.id } });
    await notification(c, p, a.id, admin.id);
    const othersNotification = await notification(c, p, admin.id, a.id);

    await deleteAccount(a.id, { accountId: admin.id, role: 'admin' });
    const retained = await db.post.findUnique({ where: { id: p.id }, include: { author: { select: FORUM_AUTHOR_SELECT } } });
    expect(retained).toMatchObject({ authorId: null, body: p.body, status: 'ACTIVE' });
    expect(serializeForumAuthor(retained.author)).toMatchObject({ name: '已注销', avatar: null, volunteerId: null });
    expect(await db.postComment.findUnique({ where: { id: comment.id } })).toMatchObject({ authorId: null, body: '历史回复' });
    expect(await db.circle.findUnique({ where: { id: c.id } })).toMatchObject({ createdById: null, status: 'ACTIVE' });
    expect(await db.circleRoleAssignment.count({ where: { circleId: c.id } })).toBe(0);
    expect(await db.circleFollow.count({ where: { accountId: a.id } })).toBe(0);
    expect(await db.postFavorite.count({ where: { accountId: a.id } })).toBe(0);
    expect(await db.notification.count({ where: { recipientId: a.id } })).toBe(0);
    expect(await db.notification.findUnique({ where: { id: othersNotification.id } })).toMatchObject({ actorId: null });
    expect(await db.postLike.findMany({ where: { postId: p.id } })).toEqual([expect.objectContaining({ accountId: null })]);
    // No inherited content or staff identity when the email is reused.
    const replacement = await user('user', a.email);
    expect(replacement.id).not.toBe(a.id);
    expect(await db.post.count({ where: { authorId: replacement.id } })).toBe(0);
    expect((await getForumAccess({ accountId: replacement.id }, c.id, db)).canModerate).toBe(false);
  });

  it('retains distinct historical likes from multiple deleted accounts', async () => {
    const c = await circle();
    const p = await post(c, admin.id);
    for (let i = 0; i < 2; i += 1) {
      const a = await user();
      await db.postLike.create({ data: { postId: p.id, accountId: a.id } });
      await expect(db.postLike.create({ data: { postId: p.id, accountId: a.id } })).rejects.toMatchObject({ code: 'P2002' });
      await deleteAccount(a.id, { accountId: admin.id, role: 'admin' });
    }
    expect(await db.postLike.count({ where: { postId: p.id, accountId: null } })).toBe(2);
  });

  it('rolls back all forum anonymization and private-data cascades if ledger deletion is refused', async () => {
    const c = await circle();
    const p = await post(c, legacyUser.id);
    const comment = await db.postComment.create({ data: { postId: p.id, authorId: legacyUser.id, body: '保留身份' } });
    await db.circleRoleAssignment.create({ data: { circleId: c.id, accountId: legacyUser.id, role: 'OWNER' } });
    await db.circleFollow.create({ data: { circleId: c.id, accountId: legacyUser.id } });
    await db.postFavorite.create({ data: { postId: p.id, accountId: legacyUser.id } });
    await db.postLike.create({ data: { postId: p.id, accountId: legacyUser.id } });
    const inbox = await notification(c, p, legacyUser.id, admin.id);
    const outbox = await notification(c, p, admin.id, legacyUser.id);
    await expect(deleteAccount(legacyUser.id, { accountId: admin.id, role: 'admin' })).rejects.toThrow(/ProjectSupport/);
    expect(await db.account.findUnique({ where: { id: legacyUser.id } })).not.toBeNull();
    expect(await db.post.findUnique({ where: { id: p.id } })).toMatchObject({ authorId: legacyUser.id });
    expect(await db.postComment.findUnique({ where: { id: comment.id } })).toMatchObject({ authorId: legacyUser.id });
    expect(await db.circleRoleAssignment.count({ where: { accountId: legacyUser.id } })).toBe(1);
    expect(await db.circleFollow.count({ where: { accountId: legacyUser.id } })).toBe(1);
    expect(await db.postFavorite.count({ where: { accountId: legacyUser.id } })).toBe(1);
    expect(await db.postLike.count({ where: { accountId: legacyUser.id } })).toBe(1);
    expect(await db.notification.findUnique({ where: { id: inbox.id } })).not.toBeNull();
    expect(await db.notification.findUnique({ where: { id: outbox.id } })).toMatchObject({ actorId: legacyUser.id });
  });

  it('preserves pure-admin content on deletion and still protects the final system admin', async () => {
    const a = (await createAdminAccount({ email: 'second-admin@example.test', password: 'TestOnly@123', name: '另一管理员' })).account;
    const c = await circle();
    const p = await post(c, a.id);
    await deleteAccount(a.id, { accountId: admin.id, role: 'admin' });
    expect(await db.post.findUnique({ where: { id: p.id } })).toMatchObject({ authorId: null });
    expect(await deleteAccount(admin.id, { accountId: 'different-operator', role: 'admin' })).toMatchObject({ lastAdmin: true });
  });

  it('foreign keys prevent hard deletion of discussions and dangling interactions', async () => {
    const c = await circle();
    const p = await post(c, admin.id);
    await db.postComment.create({ data: { postId: p.id, authorId: admin.id, body: '不能意外级联删除' } });
    await expect(db.circle.delete({ where: { id: c.id } })).rejects.toMatchObject({ code: 'P2003' });
    await expect(db.post.delete({ where: { id: p.id } })).rejects.toMatchObject({ code: 'P2003' });
    await expect(db.postFavorite.create({ data: { postId: 'missing', accountId: admin.id } })).rejects.toMatchObject({ code: 'P2003' });
    await expect(db.post.create({ data: { circleId: c.id, authorId: 'missing', title: 'bad', body: 'bad' } })).rejects.toMatchObject({ code: 'P2003' });
    await db.circle.update({ where: { id: c.id }, data: { status: 'ARCHIVED', archivedAt: new Date() } });
    const access = await getForumAccess({ accountId: admin.id }, c.id, db);
    expect(getContentPermissions(access, p)).toMatchObject({ canRead: false, canManageRead: true, canEdit: false });
  });

  it('deduplicates notification events per recipient with a database constraint', async () => {
    const c = await circle();
    const p = await post(c, admin.id);
    const n = await notification(c, p, admin.id, legacyUser.id);
    await expect(db.notification.create({ data: { recipientId: admin.id, actorId: legacyUser.id, type: n.type, eventKey: n.eventKey, targetType: n.targetType, targetId: n.targetId } })).rejects.toMatchObject({ code: 'P2002' });
    await db.notification.create({ data: { recipientId: legacyUser.id, actorId: admin.id, type: n.type, eventKey: n.eventKey, targetType: n.targetType, targetId: n.targetId } });
  });

  it('ledger audit access cannot reveal forum records through lists, IDs, history or statistics', async () => {
    const forumAudit = await audit('Post', 'post_moderation_edit', 'audit-post');
    // Also attempt the legacy history OR(modifiedId) branch.
    await db.auditLog.update({ where: { id: forumAudit.id }, data: { modifiedId: legacyUser.id } });
    for (const role of ['a_admin', 'b_admin']) {
      const viewer = { role };
      expect((await AuditService.getAuditLogs({ targetType: 'Post' }, {}, {}, viewer)).pagination.total).toBe(0);
      await expect(AuditService.getAuditLogById(forumAudit.auditId, viewer)).rejects.toThrow(/不存在/);
      expect((await AuditService.getTargetAuditHistory('Post', 'audit-post', viewer)).history).toEqual([]);
      expect((await AuditService.getTargetAuditHistory('Account', legacyUser.id, viewer)).history.every((log) => log.targetType !== 'Post')).toBe(true);
      const stats = await AuditService.getAuditStatistics({}, viewer);
      expect(stats.byTargetType).not.toHaveProperty('Post');
      expect(stats.byAction).not.toHaveProperty('post_moderation_edit');
      expect(stats.byDay.reduce((sum, day) => sum + day.count, 0)).toBe(stats.summary.totalLogs);
    }
    expect(await AuditService.getAuditLogById(forumAudit.auditId, { role: 'admin' })).toMatchObject({ action: 'post_moderation_edit' });
    expect((await AuditService.getTargetAuditHistory('Post', 'audit-post', { role: 'admin' })).count).toBe(1);
  });

  it('checks the rollback limitation: old clients can use ledger data but cannot decode new audit enums', async () => {
    expect(await oldDb.account.count()).toBeGreaterThan(0);
    expect(await oldDb.auditLog.findMany({ where: { targetType: 'Account' } })).not.toHaveLength(0);
    await expect(oldDb.auditLog.findMany()).rejects.toThrow(/enum|Value/i);
  });

  it('initializes the newcomer circle once and never reopens or duplicates it after rename', async () => {
    const [first, second] = await Promise.all([createNewcomerCircleIfMissing(), createNewcomerCircleIfMissing()]);
    expect(first.id).toBe(second.id);
    expect(await db.auditLog.count({ where: { targetId: first.id } })).toBe(1);
    await CircleService.update({ accountId: admin.id }, first.id, { slug: 'welcome-renamed' });
    await CircleService.setArchived({ accountId: admin.id }, first.id, true);
    expect(await createNewcomerCircleIfMissing()).toMatchObject({ id: first.id, slug: 'welcome-renamed', status: 'ARCHIVED' });
    expect(await db.circle.count({ where: { slug: 'newcomers' } })).toBe(0);
  });

  it('only system admins create circles, with active owners and validated fields', async () => {
    const a = await user('a_admin');
    const input = { name: '新圈子', slug: 'created-circle', description: '介绍', ownerIds: [a.id], status: 'ARCHIVED' };
    await expect(CircleService.create({ accountId: a.id, role: 'admin' }, input)).rejects.toMatchObject({ status: 403 });
    await expect(CircleService.create({ accountId: admin.id }, { ...input, ownerIds: [] })).rejects.toMatchObject({ status: 400 });
    await expect(CircleService.create({ accountId: admin.id }, { ...input, slug: 'BAD SLUG' })).rejects.toMatchObject({ status: 400 });
    await expect(CircleService.create({ accountId: admin.id }, { ...input, name: '😀'.repeat(41) })).rejects.toMatchObject({ status: 400 });
    const created = await CircleService.create({ accountId: admin.id }, input);
    expect(created).toMatchObject({ status: 'ACTIVE', name: '新圈子' });
    expect(created.roles).toEqual([expect.objectContaining({ role: 'OWNER', account: expect.objectContaining({ accountId: a.id }) })]);
    expect(await db.notification.count({ where: { circleId: created.id, recipientId: a.id } })).toBe(1);
    await expect(CircleService.create({ accountId: admin.id }, input)).rejects.toMatchObject({ status: 409 });
    const candidate = await CircleService.candidates({ accountId: a.id }, { circleId: created.id, search: a.name });
    expect(candidate.some((row) => row.accountId === a.id)).toBe(true);
    expect(candidate[0]).not.toHaveProperty('email');
    expect(candidate[0]).not.toHaveProperty('passwordHash');
  });

  it('owners manage stewards but cannot promote themselves, change slug, archive or manage another circle', async () => {
    const owner = await user();
    const steward = await user();
    const c = await CircleService.create({ accountId: admin.id }, { name: '权限圈', slug: `permissions-${++seq}`, ownerIds: [owner.id] });
    const other = await circle();
    const op = { accountId: owner.id };
    await CircleService.update(op, c.id, { name: '修改名称', status: 'ARCHIVED' });
    await expect(CircleService.update(op, c.id, { slug: 'not-allowed' })).rejects.toMatchObject({ status: 403 });
    await expect(CircleService.setArchived(op, c.id, true)).rejects.toMatchObject({ status: 403 });
    await expect(CircleService.setRole(op, other.id, steward.id, 'STEWARD')).rejects.toMatchObject({ status: 403 });
    await CircleService.setRole(op, c.id, steward.id, 'STEWARD');
    await CircleService.setRole(op, c.id, steward.id, 'STEWARD');
    expect(await db.notification.count({ where: { circleId: c.id, recipientId: steward.id } })).toBe(1);
    expect(await db.auditLog.count({ where: { targetId: c.id, action: 'circle_role_assign' } })).toBe(1);
    await expect(CircleService.setRole(op, c.id, owner.id, 'STEWARD')).rejects.toMatchObject({ status: 409 });
    await expect(CircleService.setRole(op, c.id, steward.id, 'OWNER')).rejects.toMatchObject({ status: 403 });
    await expect(CircleService.update({ accountId: steward.id }, c.id, { name: '不允许' })).rejects.toMatchObject({ status: 403 });
    await CircleService.setRole(op, c.id, steward.id, 'STEWARD', true);
    await CircleService.setRole(op, c.id, steward.id, 'STEWARD', true);
    expect(await db.notification.count({ where: { circleId: c.id, recipientId: steward.id, type: 'CIRCLE_ROLE_REMOVED' } })).toBe(1);
  });

  it('archive hides normal reads but preserves staff access and content, with idempotent restoration', async () => {
    const owner = await user();
    const ordinary = await user('b_admin');
    const c = await CircleService.create({ accountId: admin.id }, { name: '归档圈', slug: `archive-${++seq}`, ownerIds: [owner.id] });
    const p = await post(c, owner.id);
    const deleted = await db.postComment.create({ data: { postId: p.id, authorId: owner.id, body: '已删除', status: 'DELETED' } });
    await notification(c, p, owner.id, admin.id);
    await CircleService.setArchived({ accountId: admin.id }, c.id, true);
    await CircleService.setArchived({ accountId: admin.id }, c.id, true);
    expect(await db.auditLog.count({ where: { targetId: c.id, action: 'circle_archive' } })).toBe(1);
    expect((await CircleService.list({ accountId: ordinary.id })).circles.some((row) => row.id === c.id)).toBe(false);
    expect((await CircleService.list({ accountId: ordinary.id }, { view: 'manage' })).circles).toEqual([]);
    await expect(CircleService.get({ accountId: ordinary.id }, c.slug)).rejects.toMatchObject({ status: 410 });
    await expect(CircleService.get({ accountId: ordinary.id }, c.slug, { management: true })).rejects.toMatchObject({ status: 403 });
    expect((await CircleService.get({ accountId: owner.id }, c.slug, { management: true })).status).toBe('ARCHIVED');
    await expect(CircleService.setRole({ accountId: owner.id }, c.id, ordinary.id, 'STEWARD')).rejects.toMatchObject({ status: 403 });
    expect(await db.notification.count({ where: { circleId: c.id, type: 'POST_COMMENT' } })).toBe(0);
    await CircleService.setArchived({ accountId: admin.id }, c.id, false);
    expect(await db.post.findUnique({ where: { id: p.id } })).toMatchObject({ body: p.body });
    expect(await db.postComment.findUnique({ where: { id: deleted.id } })).toMatchObject({ status: 'DELETED' });
  });

  it('concurrent ownership transfers have one winner, preserving other owners and revoking the source', async () => {
    const [owner, otherOwner, first, second] = [await user(), await user(), await user(), await user()];
    const c = await CircleService.create({ accountId: admin.id }, { name: '转让圈', slug: `transfer-${++seq}`, ownerIds: [owner.id, otherOwner.id] });
    await expect(CircleService.transfer({ accountId: owner.id }, c.id, { toAccountId: owner.id })).rejects.toMatchObject({ status: 400 });
    await expect(CircleService.transfer({ accountId: owner.id }, c.id, { fromAccountId: otherOwner.id, toAccountId: first.id })).rejects.toMatchObject({ status: 403 });
    const results = await Promise.allSettled([first, second].map((a) => CircleService.transfer({ accountId: owner.id }, c.id, { toAccountId: a.id })));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await db.circleRoleAssignment.count({ where: { circleId: c.id, role: 'OWNER' } })).toBe(2);
    expect(await db.circleRoleAssignment.findUnique({ where: { circleId_accountId: { circleId: c.id, accountId: owner.id } } })).toBeNull();
    expect(await db.circleRoleAssignment.findUnique({ where: { circleId_accountId: { circleId: c.id, accountId: otherOwner.id } } })).not.toBeNull();
    await expect(CircleService.update({ accountId: owner.id }, c.id, { name: '转让后不能再改' })).rejects.toMatchObject({ status: 403 });
    expect(await db.auditLog.count({ where: { targetId: c.id, action: 'circle_ownership_transfer' } })).toBe(1);
    expect(await db.notification.count({ where: { circleId: c.id, type: 'CIRCLE_OWNERSHIP_TRANSFERRED' } })).toBe(1);
  });

  registerDirectoryTests({ db, user, circle, getAdmin: () => admin });
  registerCommentInteractionTests({ db, user, circle, getAdmin: () => admin });
  registerPostTests({ db, user, circle, getAdmin: () => admin });
  registerInteractionTests({ db, user, circle, getAdmin: () => admin });
  registerNotificationTests({ db, user, circle, getAdmin: () => admin });
  registerRichContentTests({ db, user, circle, getAdmin: () => admin });
  registerAssetMentionTests({ db, user, circle, getAdmin: () => admin });

  it('explicit system reset removes forum children in FK order and recreates a pure admin', async () => {
    expect(await db.post.count()).toBeGreaterThan(0);
    expect(await resetToSystemAdmin({ confirm: 'wrong' })).toEqual({ invalidConfirm: true });
    expect(await db.post.count()).toBeGreaterThan(0);
    const result = await resetToSystemAdmin({ confirm: 'RESET' });
    expect(result.systemAdmin).toMatchObject({ role: 'admin', volunteerId: null });
    for (const model of ['circleAsset', 'forumImage', 'notification', 'commentFavorite', 'postFavorite', 'postLike', 'postComment', 'post', 'circleFollow', 'circleRoleAssignment', 'circle', 'projectSupport', 'volunteer', 'auditLog']) {
      expect(await db[model].count(), model).toBe(0);
    }
    expect(await db.account.count()).toBe(1);
    expect(await db.department.count()).toBe(1);
  });

  it.runIf(process.env.FORUM_E2E === '1')('browser: circle lifecycle and role boundaries on desktop and mobile', async () => {
    await createNewcomerCircleIfMissing();
    for (const [name, email] of [['圈主测试', 'forum-owner@example.test'], ['协管测试', 'forum-steward@example.test'], ['接任测试', 'forum-next@example.test']]) {
      const result = await createVolunteerAccount({ volunteer: { chineseName: name, departmentId: 'FORUM_TEST', region: '其他' }, account: { email, password: 'TestOnly@123' } });
      expect(result.account).toBeDefined();
    }
    // Explicitly enable the local-only tool for this isolated browser fixture.
    const previous = { NODE_ENV: process.env.NODE_ENV, DEV_ACCOUNT_SWITCHER: process.env.DEV_ACCOUNT_SWITCHER };
    process.env.NODE_ENV = 'development';
    process.env.DEV_ACCOUNT_SWITCHER = 'true';
    try { await runForumBrowser(app); }
    finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
    }
  }, 120_000);

});
