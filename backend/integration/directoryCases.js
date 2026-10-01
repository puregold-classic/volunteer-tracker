import { it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import ForumDirectoryService from '../src/services/ForumDirectoryService.js';
import { app } from '../src/server.js';

export function registerDirectoryTests({ db, user, circle, getAdmin }) {
  const op = account => ({ accountId: account.id });
  const post = (c, authorId, extra = {}) => db.post.create({ data: {
    circleId: c.id, authorId, title: '目录帖子标题', body: '目录帖子正文', ...extra,
  } });
  const comment = (p, authorId, extra = {}) => db.postComment.create({ data: {
    postId: p.id, authorId, body: '目录评论正文', ...extra,
  } });

  it('personal directory includes direct circle/post relations without importing unrelated descendants or likes', async () => {
    const a = await user(), other = await user();
    const managed = await circle(), followed = await circle(), authored = await circle(), saved = await circle(), unrelated = await circle();
    await db.circleRoleAssignment.create({ data: { circleId: managed.id, accountId: a.id, role: 'STEWARD' } });
    await db.circleFollow.create({ data: { circleId: followed.id, accountId: a.id } });
    for (const c of [managed, followed, unrelated]) await post(c, other.id);
    const mine = await post(authored, a.id), favorite = await post(saved, other.id), liked = await post(unrelated, other.id);
    await comment(mine, other.id);
    await comment(favorite, other.id);
    await db.postFavorite.create({ data: { postId: favorite.id, accountId: a.id } });
    await db.postLike.create({ data: { postId: liked.id, accountId: a.id } });
    const result = await ForumDirectoryService.get(op(a));
    expect(result.circles).toHaveLength(4);
    expect(result.circles.find(c => c.id === managed.id)).toMatchObject({ mine: true, saved: false, circleRole: 'STEWARD', canManage: true, posts: [] });
    expect(result.circles.find(c => c.id === followed.id)).toMatchObject({ mine: false, saved: true, posts: [] });
    expect(result.circles.find(c => c.id === authored.id)).toMatchObject({ mine: false, saved: false, posts: [{ id: mine.id, mine: true, saved: false, comments: [], commentCount: 1 }] });
    expect(result.circles.find(c => c.id === saved.id)).toMatchObject({ mine: false, saved: false, posts: [{ id: favorite.id, mine: false, saved: true, comments: [], commentCount: 1 }] });
    expect(result.circles.some(c => c.id === unrelated.id)).toBe(false);
  });

  it('personal directory adds unmarked ancestors for authored/saved comments and deduplicates their paths', async () => {
    const a = await user(), other = await user(), c = await circle(), p = await post(c, other.id);
    const mine = await comment(p, a.id), saved = await comment(p, other.id);
    await comment(p, other.id);
    await post(c, other.id);
    await db.commentFavorite.createMany({ data: [mine, saved].map(row => ({ commentId: row.id, accountId: a.id })) });
    const result = await ForumDirectoryService.get(op(a));
    expect(result.circles).toHaveLength(1);
    expect(result.circles[0]).toMatchObject({ id: c.id, mine: false, saved: false, canManage: false, circleRole: null });
    expect(result.circles[0].posts).toHaveLength(1);
    const item = result.circles[0].posts[0];
    expect(item).toMatchObject({ id: p.id, mine: false, saved: false, commentCount: 3 });
    expect(item.comments).toHaveLength(2);
    expect(item.comments.find(row => row.id === mine.id)).toMatchObject({ mine: true, saved: true, excerpt: '目录评论正文', author: { accountId: a.id } });
    expect(item.comments.find(row => row.id === saved.id)).toMatchObject({ mine: false, saved: true, author: { accountId: other.id } });
    expect(JSON.stringify(result)).not.toContain(a.email);
    expect(JSON.stringify(result)).not.toContain('passwordHash');
    expect(item.comments.find(row => row.id === mine.id)).toMatchObject({ body: '目录评论正文', bodyFormat: 'MARKDOWN' });
  });

  it('personal directory keeps complete related comment bodies and their original Markdown or rich text format', async () => {
    const a = await user(), other = await user(), c = await circle(), p = await post(c, other.id);
    const markdownBody = `# 评论标题\n\n**加粗内容**\n\n${'完整长评论内容。'.repeat(80)}\n\n正文末尾`;
    const richBody = JSON.stringify({ type: 'doc', content: [
      { type: 'paragraph', content: [{ type: 'text', text: '富文本加粗内容', marks: [{ type: 'bold' }] }] },
      { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '保留列表结构' }] }] }] },
    ] });
    const markdown = await comment(p, a.id, { body: markdownBody, bodyFormat: 'MARKDOWN' });
    const rich = await comment(p, other.id, { body: richBody, bodyFormat: 'RICH_TEXT' });
    await db.commentFavorite.create({ data: { commentId: rich.id, accountId: a.id } });

    const result = await ForumDirectoryService.get(op(a));
    const replies = result.circles[0].posts[0].comments;
    expect(replies.find(row => row.id === markdown.id)).toMatchObject({ body: markdownBody, bodyFormat: 'MARKDOWN' });
    expect(replies.find(row => row.id === markdown.id).excerpt).not.toContain('正文末尾');
    expect(replies.find(row => row.id === rich.id)).toMatchObject({ body: richBody, bodyFormat: 'RICH_TEXT' });
    expect(replies.find(row => row.id === rich.id).excerpt).toContain('保留列表结构');
  });

  it('personal directory preserves real relations on ancestors, allowing every level to be both mine and saved', async () => {
    const a = await user(), c = await circle(), p = await post(c, a.id), reply = await comment(p, a.id);
    await db.circleRoleAssignment.create({ data: { circleId: c.id, accountId: a.id, role: 'OWNER' } });
    await db.circleFollow.create({ data: { circleId: c.id, accountId: a.id } });
    await db.postFavorite.create({ data: { postId: p.id, accountId: a.id } });
    await db.commentFavorite.create({ data: { commentId: reply.id, accountId: a.id } });
    const result = await ForumDirectoryService.get(op(a));
    expect(result.circles).toHaveLength(1);
    const root = result.circles[0];
    expect(root).toMatchObject({ mine: true, saved: true, circleRole: 'OWNER' });
    expect(root.posts).toHaveLength(1);
    expect(root.posts[0]).toMatchObject({ mine: true, saved: true, comments: [{ id: reply.id, mine: true, saved: true }] });
  });

  it('personal directory redacts archived circles and every descendant even for their manager', async () => {
    const a = await user();
    const c = await circle();
    await db.circle.update({ where: { id: c.id }, data: { name: '隐藏圈名', description: '隐藏圈子介绍', status: 'ARCHIVED', archivedAt: new Date() } });
    await db.circleRoleAssignment.create({ data: { circleId: c.id, accountId: a.id, role: 'OWNER' } });
    const p = await post(c, a.id, { title: '隐藏标题', body: '隐藏帖子正文' });
    await comment(p, a.id, { body: '隐藏评论正文', isPinned: true });
    const result = await ForumDirectoryService.get(op(a));
    const root = result.circles[0], item = root.posts[0], reply = item.comments[0];
    expect(root).toMatchObject({ mine: true, name: null, slug: null, managementSlug: c.slug, description: null, coverId: null, canManage: true, unavailableReason: '圈子已归档' });
    expect(item).toMatchObject({ title: null, excerpt: null, author: null, commentCount: null, unavailableReason: '圈子已归档' });
    expect(reply).toMatchObject({ excerpt: null, body: null, bodyFormat: null, author: null, isPinned: false, unavailableReason: '圈子已归档' });
    const serialized = JSON.stringify(result);
    for (const secret of ['隐藏圈名', '隐藏圈子介绍', '隐藏标题', '隐藏帖子正文', '隐藏评论正文']) expect(serialized).not.toContain(secret);
    const follower = await user();
    await db.circleFollow.create({ data: { circleId: c.id, accountId: follower.id } });
    const followerResult = await ForumDirectoryService.get(op(follower));
    expect(followerResult.circles[0]).toMatchObject({ slug: null, managementSlug: null, canManage: false, posts: [] });
    expect(JSON.stringify(followerResult)).not.toContain(c.slug);
  });

  it('personal directory retains deleted placeholders without revealing their content or hiding readable ancestors', async () => {
    const a = await user(), other = await user(), c = await circle();
    const deletedPost = await post(c, other.id, { title: '不能显示的删除标题', body: '不能显示的删除正文', status: 'DELETED', deletedAt: new Date() });
    const hiddenReply = await comment(deletedPost, a.id, { body: '不能显示的下级回复' });
    const activePost = await post(c, other.id), deletedReply = await comment(activePost, a.id, { body: '不能显示的删除回复', status: 'DELETED', deletedAt: new Date() });
    const result = await ForumDirectoryService.get(op(a));
    const root = result.circles[0];
    expect(root).toMatchObject({ name: c.name, slug: c.slug, unavailableReason: null, mine: false, saved: false });
    expect(root.posts.find(p => p.id === deletedPost.id)).toMatchObject({ title: null, excerpt: null, author: null, commentCount: null, unavailableReason: '帖子已删除', comments: [{ id: hiddenReply.id, excerpt: null, body: null, bodyFormat: null, author: null, unavailableReason: '帖子已删除' }] });
    expect(root.posts.find(p => p.id === activePost.id)).toMatchObject({ title: activePost.title, unavailableReason: null, comments: [{ id: deletedReply.id, excerpt: null, body: null, bodyFormat: null, author: null, unavailableReason: '评论已删除' }] });
    expect(JSON.stringify(result)).not.toContain('不能显示');
  });

  it('personal directory is scoped to persisted personal relations, including for system admins and inactive accounts', async () => {
    const c = await circle(), a = await user();
    await post(c, a.id);
    const adminResult = await ForumDirectoryService.get(op(getAdmin()));
    expect(adminResult.circles.some(row => row.id === c.id)).toBe(false);
    const empty = await user();
    expect(await ForumDirectoryService.get({ accountId: empty.id, role: 'admin' })).toEqual({ circles: [] });
    await db.account.update({ where: { id: a.id }, data: { isActive: false } });
    await expect(ForumDirectoryService.get(op(a))).rejects.toMatchObject({ status: 401 });
    await expect(ForumDirectoryService.get({ accountId: 'missing-account' })).rejects.toMatchObject({ status: 401 });
    await expect(ForumDirectoryService.get(null)).rejects.toMatchObject({ status: 401 });
  });

  it('personal directory returns all personally related comments with stable ordering rather than an implicit first page', async () => {
    const a = await user(), c = await circle(), p = await post(c, getAdmin().id), at = new Date('2026-09-29T00:00:00Z');
    await db.postComment.createMany({ data: Array.from({ length: 25 }, (_, i) => ({ id: `${p.id}-dir-${String(i).padStart(2, '0')}`, postId: p.id, authorId: a.id, body: `目录评论 ${i}`, createdAt: at })) });
    const result = await ForumDirectoryService.get(op(a));
    expect(result.circles[0].posts[0].comments.map(row => row.id)).toEqual(Array.from({ length: 25 }, (_, i) => `${p.id}-dir-${String(24 - i).padStart(2, '0')}`));
  });

  it('personal directory HTTP route requires authentication and returns a private no-store response', async () => {
    const a = await user(), other = await user(), c = await circle(), p = await post(c, a.id);
    const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const root = `http://127.0.0.1:${server.address().port}/api/v1/forum/me/directory`;
    const headers = account => ({ Authorization: `Bearer ${jwt.sign({ sub: account.id }, process.env.JWT_SECRET, { expiresIn: '5m' })}` });
    try {
      expect((await fetch(root)).status).toBe(401);
      const response = await fetch(`${root}?accountId=${other.id}`, { headers: headers(a) });
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      expect(response.headers.get('vary')).toContain('Authorization');
      expect(await response.json()).toMatchObject({ success: true, data: { circles: [{ id: c.id, posts: [{ id: p.id, mine: true }] }] } });
      expect(await (await fetch(root, { headers: headers(other) })).json()).toEqual({ success: true, data: { circles: [] } });
    } finally { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); }
  });
}
