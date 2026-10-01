import { it, expect } from 'vitest';
import PostService from '../src/services/PostService.js';
import CircleService from '../src/services/CircleService.js';
import { deleteAccount } from '../src/services/AccountService.js';

export function registerPostTests({ db, user, circle, getAdmin }) {
  const op = (a) => ({ accountId: a.id });
  const create = (a, c, title = '讨论标题') => PostService.create(op(a), c.slug, { title, body: '**分享正文**' });
  it('content: all account roles may publish, identity fields are whitelisted, Unicode limits agree', async () => {
    const c = await circle();
    for (const a of [getAdmin(), await user(), await user('a_admin'), await user('b_admin')]) {
      const p = await PostService.create(op(a), c.slug, { title: '😊'.repeat(100), body: '文'.repeat(5000), authorId: getAdmin().id, isPinned: true, status: 'DELETED' });
      expect(p).toMatchObject({ author: { accountId: a.id }, status: 'ACTIVE', capabilities: { canEdit: true } });
      expect(await db.post.findUnique({ where: { id: p.id } })).toMatchObject({ authorId: a.id, isPinned: false });
    }
    for (const input of [{ title: '😊'.repeat(101), body: 'ok' }, { title: 'ok', body: '😊'.repeat(5001) }, { title: ' ', body: 'ok' }, { title: 'ok', body: [] }]) {
      await expect(PostService.create(op(getAdmin()), c.slug, input)).rejects.toMatchObject({ status: 400 });
    }
    const list = await PostService.list(op(getAdmin()), c.slug, { page: '1', limit: '2' });
    expect(list).toMatchObject({ total: 4, count: 2, totalPages: 2 });
    expect(list.data[0].body).toBeUndefined();
    expect(list.data[0].author).not.toHaveProperty('email');
    await expect(PostService.list(op(getAdmin()), c.slug, { page: 'no' })).rejects.toMatchObject({ status: 400 });
  });
  it('content: staff cannot rewrite others or moderate other circles; admin edits are marked and audited', async () => {
    const [author, staff] = [await user(), await user('a_admin')], c = await circle(), other = await circle();
    await CircleService.setRole(op(getAdmin()), c.id, staff.id, 'STEWARD');
    const p = await create(author, c), elsewhere = await create(author, other);
    const comment = await PostService.addComment(op(author), p.id, { body: '原评论' });
    await expect(PostService.edit(op(staff), p.id, { title: '篡改', body: '篡改' })).rejects.toMatchObject({ status: 403 });
    await expect(PostService.edit(op(staff), comment.id, { body: '篡改' }, true)).rejects.toMatchObject({ status: 403 });
    await expect(PostService.setDeleted(op(staff), elsewhere.id, true)).rejects.toMatchObject({ status: 403 });
    const beforeEdit = await PostService.get(op(author), p.id);
    await PostService.edit(op(getAdmin()), p.id, { title: '管理修订', body: '修订正文', updatedAt: beforeEdit.updatedAt.toISOString() });
    const edited = await PostService.get(op(author), p.id);
    expect(edited).toMatchObject({ title: '管理修订', lastEditKind: 'ADMIN' });
    expect(edited.lastActivityAt).toEqual(beforeEdit.lastActivityAt);
    expect(await db.auditLog.findFirst({ where: { targetId: p.id, action: 'post_moderation_edit' } })).toMatchObject({ actionDetails: { before: { body: '**分享正文**' }, after: { body: '修订正文' } } });
    await PostService.edit(op(getAdmin()), p.id, { title: '管理修订', body: '修订正文' });
    expect(await db.notification.count({ where: { targetId: p.id, type: 'CONTENT_EDITED' } })).toBe(1);
    await expect(PostService.edit(op(author), p.id, { title: '过期编辑', body: '文字', updatedAt: p.updatedAt.toISOString() })).rejects.toMatchObject({ status: 409 });
    await PostService.edit(op(getAdmin()), comment.id, { body: '管理修订评论' }, true);
    expect((await PostService.comments(op(author), p.id)).data[0].lastEditKind).toBe('ADMIN');
  });
  it('content: replies notify only the author and deletion removes reply notifications atomically', async () => {
    const [author, visitor] = [await user(), await user()], c = await circle(), p = await create(author, c);
    const mine = await PostService.addComment(op(author), p.id, { body: '自己补充' });
    expect(await db.notification.count({ where: { postId: p.id } })).toBe(0);
    const reply = await PostService.addComment(op(visitor), p.id, { body: '感谢分享 😊' });
    expect(await db.notification.findFirst({ where: { postId: p.id } })).toMatchObject({ recipientId: author.id, actorId: visitor.id, targetId: reply.id, targetType: 'PostComment' });
    await PostService.setDeleted(op(visitor), reply.id, true, true);
    await PostService.setDeleted(op(visitor), reply.id, true, true);
    expect(await db.notification.count({ where: { postId: p.id } })).toBe(0);
    expect(await db.post.findUnique({ where: { id: p.id } })).toMatchObject({ lastActivityAt: mine.createdAt });
    expect((await PostService.get(op(visitor), p.id)).commentCount).toBe(1);
    await expect(PostService.setDeleted(op(visitor), reply.id, false, true)).rejects.toMatchObject({ status: 403 });
    await PostService.setDeleted(op(getAdmin()), reply.id, false, true);
    await PostService.setDeleted(op(getAdmin()), reply.id, false, true);
    expect(await db.notification.count({ where: { postId: p.id, type: 'POST_COMMENT' } })).toBe(0);
    expect(await db.notification.count({ where: { targetId: reply.id, type: 'CONTENT_RESTORED' } })).toBe(1);
    await PostService.setDeleted(op(author), p.id, true);
    await expect(PostService.get(op(author), p.id)).rejects.toMatchObject({ status: 410 });
    await expect(PostService.comments(op(visitor), p.id)).rejects.toMatchObject({ status: 410 });
    await expect(PostService.addComment(op(visitor), p.id, { body: '不能回帖' })).rejects.toMatchObject({ status: 403 });
    const own = await PostService.mine(op(author));
    expect(own.data.find((row) => row.id === p.id)).toMatchObject({ title: null, excerpt: null, unavailableReason: '帖子已删除' });
    const ownComment = await PostService.mine(op(visitor), true);
    expect(ownComment.data.find((row) => row.id === reply.id)).toMatchObject({ title: null, excerpt: null });
    expect((await PostService.get(op(getAdmin()), p.id, { view: 'manage' })).body).toBe('**分享正文**');
    await PostService.setDeleted(op(getAdmin()), p.id, false);
    expect((await PostService.get(op(author), p.id)).status).toBe('ACTIVE');
  });
  it('content: circle staff restore content, archived views are explicit and remain read only', async () => {
    const [author, staff] = [await user(), await user()], c = await circle(), p = await create(author, c);
    await CircleService.setRole(op(getAdmin()), c.id, staff.id, 'STEWARD');
    const reply = await PostService.addComment(op(author), p.id, { body: '隐藏评论' });
    await PostService.setDeleted(op(staff), reply.id, true, true);
    await PostService.setDeleted(op(staff), p.id, true);
    await expect(PostService.get(op(author), p.id, { view: 'manage' })).rejects.toMatchObject({ status: 403 });
    expect((await PostService.list(op(staff), c.slug, { view: 'manage' })).total).toBe(1);
    await PostService.setDeleted(op(staff), p.id, false);
    expect((await PostService.comments(op(author), p.id)).total).toBe(0);
    await CircleService.setArchived(op(getAdmin()), c.id, true);
    for (const a of [author, staff, getAdmin()]) {
      await expect(PostService.get(op(a), p.id)).rejects.toMatchObject({ status: 410 });
      await expect(PostService.create(op(a), c.slug, { title: '不允许', body: '不允许' })).rejects.toMatchObject({ status: 403 });
      await expect(PostService.setDeleted(op(a), p.id, true)).rejects.toMatchObject({ status: 403 });
    }
    expect((await PostService.get(op(staff), p.id, { view: 'manage' })).capabilities).toMatchObject({ canEdit: false, canDelete: false, canInteract: false });
    await expect(PostService.setDeleted(op(getAdmin()), reply.id, false, true)).rejects.toMatchObject({ status: 403 });
    expect((await PostService.mine(op(author))).data[0]).toMatchObject({ title: null, excerpt: null, unavailableReason: '圈子已归档' });
    expect((await PostService.mine(op(author), true)).data[0]).toMatchObject({ title: null, excerpt: null });
    await CircleService.setArchived(op(getAdmin()), c.id, false);
    expect((await PostService.comments(op(author), p.id)).total).toBe(0);
    await PostService.setDeleted(op(staff), reply.id, false, true);
    expect((await PostService.comments(op(author), p.id)).total).toBe(1);
  });
  it('content: comment cursors and location are stable for equal timestamps and reject other posts', async () => {
    const a = await user(), c = await circle(), p = await create(a, c), other = await create(a, c, '另一帖');
    const at = new Date('2026-09-01T12:00:00Z');
    await db.postComment.createMany({ data: Array.from({ length: 25 }, (_, i) => ({ id: `${p.id}-${String(i).padStart(2, '0')}`, postId: p.id, authorId: a.id, body: `第 ${i} 条`, createdAt: at })) });
    const first = await PostService.comments(op(a), p.id);
    expect(first.count).toBe(20);
    const next = await PostService.comments(op(a), p.id, { cursor: first.nextCursor });
    expect(next.count).toBe(5);
    expect(new Set([...first.data, ...next.data].map((r) => r.id)).size).toBe(25);
    const located = await PostService.comments(op(a), p.id, { commentId: next.data[2].id });
    expect(located.data[0].id).toBe(next.data[2].id);
    expect(located.hasEarlier).toBe(true);
    await expect(PostService.comments(op(a), other.id, { commentId: next.data[2].id })).rejects.toMatchObject({ status: 410 });
    await PostService.setDeleted(op(a), next.data[2].id, true, true);
    await expect(PostService.comments(op(a), p.id, { commentId: next.data[2].id })).rejects.toMatchObject({ status: 410 });
    expect((await PostService.comments(op(a), p.id, { cursor: next.data[2].id })).count).toBe(2);
  });
  it('content: concurrent replies and removals preserve counts and exact last activity', async () => {
    const a = await user(), c = await circle(), p = await create(a, c);
    const comments = await Promise.all(['一', '二', '三'].map((body) => PostService.addComment(op(a), p.id, { body })));
    const latest = comments.reduce((value, row) => row.createdAt > value ? row.createdAt : value, p.createdAt);
    expect(await db.post.findUnique({ where: { id: p.id } })).toMatchObject({ lastActivityAt: latest });
    await Promise.all(comments.map((r) => PostService.setDeleted(op(a), r.id, true, true)));
    expect((await PostService.get(op(a), p.id)).commentCount).toBe(0);
    expect(await db.post.findUnique({ where: { id: p.id } })).toMatchObject({ lastActivityAt: p.createdAt });
    await Promise.all(comments.map((r) => PostService.setDeleted(op(getAdmin()), r.id, false, true)));
    expect((await PostService.get(op(a), p.id)).lastActivityAt).toEqual(latest);
  });
  it('content: concurrent deletion versus reply leaves no accessible child or stale reply notice', async () => {
    const [a, visitor] = [await user(), await user()], c = await circle(), p = await create(a, c);
    const results = await Promise.allSettled([PostService.setDeleted(op(a), p.id, true), PostService.addComment(op(visitor), p.id, { body: '并发回复' })]);
    expect(results[0].status).toBe('fulfilled');
    expect(await db.notification.count({ where: { postId: p.id, type: 'POST_COMMENT' } })).toBe(0);
    await expect(PostService.comments(op(visitor), p.id)).rejects.toMatchObject({ status: 410 });
  });
  it('content: persisted account status wins over forged roles and deleted authors stay anonymous', async () => {
    const a = await user(), visitor = await user(), c = await circle(), p = await create(a, c);
    await PostService.addComment(op(a), p.id, { body: '历史评论' });
    await expect(PostService.edit({ ...op(visitor), role: 'admin' }, p.id, { title: '伪造', body: '伪造' })).rejects.toMatchObject({ status: 403 });
    await db.account.update({ where: { id: visitor.id }, data: { isActive: false } });
    await expect(PostService.get(op(visitor), p.id)).rejects.toMatchObject({ status: 401 });
    await expect(PostService.mine({ accountId: 'missing' })).rejects.toMatchObject({ status: 401 });
    await deleteAccount(a.id);
    expect((await PostService.get(op(getAdmin()), p.id)).author).toMatchObject({ name: '已注销', accountId: null, volunteerId: null });
    expect((await PostService.comments(op(getAdmin()), p.id)).data[0].author.name).toBe('已注销');
  });
}
