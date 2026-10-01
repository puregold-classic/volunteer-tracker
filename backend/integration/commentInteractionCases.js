import { it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import PostService from '../src/services/PostService.js';
import ForumInteractionService from '../src/services/ForumInteractionService.js';
import CircleService from '../src/services/CircleService.js';
import { deleteAccount } from '../src/services/AccountService.js';
import { app } from '../src/server.js';

export function registerCommentInteractionTests({ db, user, circle, getAdmin }) {
  const op = a => ({ accountId: a.id });
  const create = (a, c) => PostService.create(op(a), c.slug, { title: '置顶与收藏测试', body: '帖子内容' });
  it('comment pins: only the post author can pin, multiple pins page and locate without omissions', async () => {
    const author = await user(), visitor = await user(), c = await circle(), p = await create(author, c);
    const at = new Date('2026-09-29T00:00:00Z');
    await db.postComment.createMany({ data: Array.from({ length: 25 }, (_, i) => ({ id: `${p.id}-${String(i).padStart(2, '0')}`, postId: p.id, authorId: visitor.id, body: `回复${i}`, createdAt: at })) });
    const pinned = [`${p.id}-04`, `${p.id}-24`];
    for (const a of [visitor, getAdmin()]) {
      await expect(ForumInteractionService.comment(op(a), pinned[0], 'pin', true)).rejects.toMatchObject({ status: 403 });
      expect((await PostService.comments(op(a), p.id)).data[0].capabilities.canPin).toBe(false);
    }
    for (const id of pinned) {
      await ForumInteractionService.comment(op(author), id, 'pin', true);
      await ForumInteractionService.comment(op(author), id, 'pin', true);
    }
    expect(await db.auditLog.count({ where: { targetId: { in: pinned }, action: 'comment_pin' } })).toBe(2);
    const first = await PostService.comments(op(visitor), p.id, { limit: '1' });
    expect(first.data[0]).toMatchObject({ id: pinned[0], isPinned: true });
    const second = await PostService.comments(op(visitor), p.id, { cursor: first.nextCursor, limit: '1' });
    expect(second.data[0].id).toBe(pinned[1]);
    const third = await PostService.comments(op(visitor), p.id, { cursor: second.nextCursor });
    expect(third.data[0].id).toBe(`${p.id}-00`);
    const last = await PostService.comments(op(visitor), p.id, { cursor: third.nextCursor });
    expect(new Set([...first.data, ...second.data, ...third.data, ...last.data].map(r => r.id)).size).toBe(25);
    const located = await PostService.comments(op(visitor), p.id, { commentId: pinned[1] });
    expect(located.data[0].id).toBe(pinned[1]); expect(located.hasEarlier).toBe(true);
    await ForumInteractionService.comment(op(author), pinned[0], 'pin', false);
    expect((await PostService.comments(op(author), p.id)).data[0].id).toBe(pinned[1]);
    await PostService.setDeleted(op(visitor), pinned[1], true, true);
    await expect(ForumInteractionService.comment(op(author), pinned[1], 'pin', false)).rejects.toMatchObject({ status: 403 });
    expect((await PostService.comments(op(author), p.id)).data.every(r => !r.isPinned)).toBe(true);
    await CircleService.setArchived(op(getAdmin()), c.id, true);
    await expect(ForumInteractionService.comment(op(author), pinned[0], 'pin', true)).rejects.toMatchObject({ status: 403 });
  });
  it('comment favorites: private, idempotent, hidden content redacted, removal survives deletion and archive', async () => {
    const author = await user(), a = await user(), b = await user(), c = await circle(), p = await create(author, c);
    const reply = await PostService.addComment(op(author), p.id, { body: '收藏这条评论' });
    await Promise.all([1, 2].map(() => ForumInteractionService.comment(op(a), reply.id, 'favorite', true)));
    expect(await db.commentFavorite.count({ where: { commentId: reply.id } })).toBe(1);
    expect((await PostService.comments(op(a), p.id)).data[0].isFavorited).toBe(true);
    expect((await PostService.comments(op(b), p.id)).data[0].isFavorited).toBe(false);
    expect((await ForumInteractionService.commentFavorites(op(a))).data[0]).toMatchObject({ id: reply.id, postId: p.id, excerpt: '收藏这条评论' });
    expect((await ForumInteractionService.commentFavorites(op(b))).total).toBe(0);
    await PostService.setDeleted(op(author), reply.id, true, true);
    expect((await ForumInteractionService.commentFavorites(op(a))).data[0]).toMatchObject({ title: null, excerpt: null, unavailableReason: '评论已删除' });
    await expect(ForumInteractionService.comment(op(b), reply.id, 'favorite', true)).rejects.toMatchObject({ status: 403 });
    await CircleService.setArchived(op(getAdmin()), c.id, true);
    expect((await ForumInteractionService.commentFavorites(op(a))).data[0].unavailableReason).toBe('圈子已归档');
    await ForumInteractionService.comment(op(a), reply.id, 'favorite', false);
    expect((await ForumInteractionService.commentFavorites(op(a))).total).toBe(0);
    await CircleService.setArchived(op(getAdmin()), c.id, false);
    await PostService.setDeleted(op(getAdmin()), reply.id, false, true);
    await ForumInteractionService.comment(op(a), reply.id, 'favorite', true);
    await PostService.setDeleted(op(author), p.id, true);
    expect((await ForumInteractionService.commentFavorites(op(a))).data[0]).toMatchObject({ title: null, excerpt: null, unavailableReason: '帖子已删除' });
    await deleteAccount(a.id);
    expect(await db.commentFavorite.count({ where: { accountId: a.id } })).toBe(0);
  });
  it('comment HTTP routes require authentication and honor persisted ownership', async () => {
    const author = await user(), visitor = await user(), c = await circle(), p = await create(author, c);
    const reply = await PostService.addComment(op(visitor), p.id, { body: 'HTTP评论' });
    const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const root = `http://127.0.0.1:${server.address().port}/api/v1/forum`;
    const headers = a => ({ Authorization: `Bearer ${jwt.sign({ sub: a.id }, process.env.JWT_SECRET, { expiresIn: '5m' })}` });
    try {
      expect((await fetch(`${root}/comments/${reply.id}/pin`, { method: 'PUT' })).status).toBe(401);
      expect((await fetch(`${root}/comments/${reply.id}/pin`, { method: 'PUT', headers: headers(visitor) })).status).toBe(403);
      expect((await fetch(`${root}/comments/${reply.id}/pin`, { method: 'PUT', headers: headers(author) })).status).toBe(200);
      expect((await fetch(`${root}/comments/${reply.id}/favorite`, { method: 'PUT', headers: headers(visitor) })).status).toBe(200);
      const result = await fetch(`${root}/me/comment-favorites`, { headers: headers(visitor) });
      expect((await result.json()).data[0].id).toBe(reply.id);
      expect((await fetch(`${root}/comments/${reply.id}/favorite`, { method: 'DELETE', headers: headers(visitor) })).status).toBe(200);
    } finally { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); }
  });
}
