import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getForumAccess, getContentPermissions } from '../utils/forumPermissions.js';
import { FORUM_AUTHOR_SELECT, serializeForumAuthor } from '../utils/forumIdentity.js';

const db = {
  account: { findUnique: vi.fn() },
  circle: { findUnique: vi.fn() },
};
const operator = { accountId: 'account-1' };
const post = { id: 'post-1', circleId: 'circle-1', authorId: 'someone-else', status: 'ACTIVE' };

beforeEach(() => {
  vi.resetAllMocks();
  db.account.findUnique.mockResolvedValue({ id: operator.accountId, role: 'user', isActive: true });
  db.circle.findUnique.mockResolvedValue({ id: 'circle-1', status: 'ACTIVE', roles: [] });
});

describe('forum permissions', () => {
  it.each(['user', 'a_admin', 'b_admin'])('%s has identical basic participation without circle powers', async (role) => {
    db.account.findUnique.mockResolvedValue({ id: operator.accountId, role, isActive: true });
    const access = await getForumAccess({ ...operator, role, departmentId: 'TECH' }, 'circle-1', db);
    expect(access).toMatchObject({ canRead: true, canParticipate: true, canCreateCircle: false, canModerate: false, canManageOwners: false });
    expect(getContentPermissions(access, post)).toMatchObject({ canRead: true, canInteract: true, canEdit: false, canDelete: false });
    expect(getContentPermissions(access, { ...post, authorId: operator.accountId })).toMatchObject({ canEdit: true, canDelete: true });
  });

  it('system admin needs no volunteer or circle assignment, and can edit others', async () => {
    db.account.findUnique.mockResolvedValue({ id: operator.accountId, role: 'admin', isActive: true });
    const access = await getForumAccess(operator, 'circle-1', db);
    expect(access).toMatchObject({ isSystemAdmin: true, canParticipate: true, canCreateCircle: true, canModerate: true, canManageOwners: true, canArchiveCircle: true });
    expect(getContentPermissions(access, post)).toMatchObject({ canEdit: true, canDelete: true, canFeature: true });
  });

  it('ignores a spoofed or stale system role on the supplied operator', async () => {
    const access = await getForumAccess({ ...operator, role: 'admin' }, 'circle-1', db);
    expect(access.isSystemAdmin).toBe(false);
    expect(access.canCreateCircle).toBe(false);
  });

  it.each(['OWNER', 'STEWARD'])('%s moderates only the resolved circle and cannot rewrite others', async (role) => {
    db.circle.findUnique.mockResolvedValue({ id: 'circle-1', status: 'ACTIVE', roles: [{ role }] });
    const access = await getForumAccess(operator, 'circle-1', db);
    expect(access.canModerate).toBe(true);
    expect(access.canManageStewards).toBe(role === 'OWNER');
    expect(access.canTransferOwnership).toBe(role === 'OWNER');
    expect(access.canManageOwners).toBe(false);
    expect(getContentPermissions(access, post)).toMatchObject({ canEdit: false, canDelete: true, canPin: true });
    expect(Object.values(getContentPermissions(access, { ...post, circleId: 'other-circle' }))).not.toContain(true);
    expect(db.circle.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'circle-1' },
      select: expect.objectContaining({ roles: { where: { accountId: 'account-1' }, select: { role: true } } }),
    }));
  });

  it.each([null, { id: 'account-1', role: 'admin', isActive: false }])('rejects deleted or inactive accounts', async (account) => {
    db.account.findUnique.mockResolvedValue(account);
    const access = await getForumAccess(operator, 'circle-1', db);
    expect(access).toMatchObject({ accountId: null, canRead: false, canParticipate: false, canCreateCircle: false });
    expect(db.circle.findUnique).not.toHaveBeenCalled();
    expect(Object.values(getContentPermissions(access, { ...post, authorId: null }))).not.toContain(true);
  });

  it('anonymous callers cannot become the owner of an anonymized post', async () => {
    const access = await getForumAccess(null, 'circle-1', db);
    expect(Object.values(getContentPermissions(access, { ...post, authorId: null }))).not.toContain(true);
    expect(db.account.findUnique).not.toHaveBeenCalled();
  });

  it('a missing circle grants no circle permissions, even for admin', async () => {
    db.account.findUnique.mockResolvedValue({ id: 'account-1', role: 'admin', isActive: true });
    db.circle.findUnique.mockResolvedValue(null);
    const access = await getForumAccess(operator, 'missing', db);
    expect(access).toMatchObject({ canCreateCircle: true, canParticipate: false, canModerate: false, canViewManagement: false });
  });

  it.each(['user', 'a_admin', 'b_admin', 'admin'])('archived circles remain read-only for %s, even with OWNER assignment', async (role) => {
    db.account.findUnique.mockResolvedValue({ id: 'account-1', role, isActive: true });
    db.circle.findUnique.mockResolvedValue({ id: 'circle-1', status: 'ARCHIVED', roles: [{ role: 'OWNER' }] });
    const access = await getForumAccess(operator, 'circle-1', db);
    expect(access).toMatchObject({ canRead: false, canParticipate: false, canModerate: false, canViewManagement: true, canRestoreCircle: role === 'admin' });
    expect(getContentPermissions(access, post)).toMatchObject({ canRead: false, canManageRead: true, canEdit: false, canDelete: false });
  });

  it('deleted posts are available only in a privileged management view', async () => {
    const access = await getForumAccess(operator, 'circle-1', db);
    const deleted = { ...post, status: 'DELETED', authorId: operator.accountId };
    expect(Object.values(getContentPermissions(access, deleted))).not.toContain(true);
    db.circle.findUnique.mockResolvedValue({ id: 'circle-1', status: 'ACTIVE', roles: [{ role: 'STEWARD' }] });
    const staffAccess = await getForumAccess(operator, 'circle-1', db);
    expect(getContentPermissions(staffAccess, deleted)).toMatchObject({ canRead: false, canManageRead: true, canRestore: true, canEdit: false });
  });

  it('comments inherit parent state; only their post author can pin and nobody can feature', async () => {
    db.account.findUnique.mockResolvedValue({ id: 'account-1', role: 'admin', isActive: true });
    const access = await getForumAccess(operator, 'circle-1', db);
    const comment = { id: 'comment-1', authorId: 'account-1', status: 'ACTIVE', post };
    expect(getContentPermissions(access, comment)).toMatchObject({ canEdit: true, canPin: false, canFeature: false });
    expect(getContentPermissions(access, { ...comment, post: { ...post, authorId: 'account-1' } }).canPin).toBe(true);
    expect(getContentPermissions(access, { ...comment, post: { ...post, status: 'DELETED' } })).toMatchObject({ canRead: false, canInteract: false, canEdit: false, canDelete: false });
    expect(Object.values(getContentPermissions(access, { ...comment, post: { ...post, circleId: 'other-circle' } }))).not.toContain(true);
  });
});

describe('forum author identity', () => {
  it('uses only safe fields, keeping personal contacts and credentials out of the DTO', () => {
    const author = serializeForumAuthor({ id: 'a1', name: '账号名', role: 'a_admin', email: 'private@example.test', passwordHash: 'secret', volunteer: { id: 'v1', chineseName: '张三', avatar: '/avatar', phone: 'private', birthday: new Date() } });
    expect(author).toEqual({ accountId: 'a1', name: '张三', avatar: '/avatar', volunteerId: 'v1', isDeleted: false, isSystemAdmin: false });
    expect(FORUM_AUTHOR_SELECT).not.toHaveProperty('email');
    expect(FORUM_AUTHOR_SELECT).not.toHaveProperty('passwordHash');
  });

  it('admin has an account identity and no fake volunteer', () => {
    expect(serializeForumAuthor({ id: 'admin', name: '系统管理员', role: 'admin' })).toEqual({ accountId: 'admin', name: '系统管理员', avatar: null, volunteerId: null, isDeleted: false, isSystemAdmin: true });
  });

  it('deleted authors have no identifying name, avatar or profile link', () => {
    expect(serializeForumAuthor(null)).toEqual({ accountId: null, name: '已注销', avatar: null, volunteerId: null, isDeleted: true, isSystemAdmin: false });
  });
});
