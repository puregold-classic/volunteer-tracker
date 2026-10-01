import { it, expect } from 'vitest';
import sharp from 'sharp';
import jwt from 'jsonwebtoken';
import ForumImageService, { IMAGE_LIMITS } from '../src/services/ForumImageService.js';
import PostService from '../src/services/PostService.js';
import CircleService from '../src/services/CircleService.js';
import { deleteAccount } from '../src/services/AccountService.js';
import { app } from '../src/server.js';
export function registerRichContentTests({ db, user, circle, getAdmin }) {
  const op = (a) => ({ accountId: a.id });
  const png = () => sharp({ create: { width: 20, height: 12, channels: 3, background: '#c88742' } }).png().toBuffer();
  const rich = (ids = [], text = '图片与文字') => ({ bodyFormat: 'RICH_TEXT', body: JSON.stringify({ type: 'doc', content: [
    ...(text ? [{ type: 'paragraph', content: [{ type: 'text', text }] }] : []), ...ids.map((id) => ({ type: 'forumImage', attrs: { imageId: id } })),
  ] }) });
  it('rich content: draft privacy, publication binding and no cross-post/cross-account image reuse', async () => {
    const c = await circle(), a = await user(), b = await user(), input = await png();
    const image = await ForumImageService.upload(op(a), c.id, input);
    expect(await ForumImageService.get(op(a), image.id)).toMatchObject({ mimeType: 'image/webp' });
    for (const actor of [b, getAdmin()]) await expect(ForumImageService.get(op(actor), image.id)).rejects.toMatchObject({ status: 403 });
    await expect(PostService.create(op(b), c.slug, { title: '盗用', ...rich([image.id]) })).rejects.toMatchObject({ status: 403 });
    expect(await db.post.count({ where: { circleId: c.id } })).toBe(0);
    const p = await PostService.create(op(a), c.slug, { title: '图文帖子', ...rich([image.id]) });
    expect(p.bodyFormat).toBe('RICH_TEXT'); expect((await PostService.list(op(b), c.slug)).data[0].excerpt).toBe('图片与文字');
    expect((await ForumImageService.get(op(b), image.id)).data.length).toBeGreaterThan(0);
    await expect(PostService.create(op(a), c.slug, { title: '复用', ...rich([image.id]) })).rejects.toMatchObject({ status: 403 });
    const other = await circle(), draft = await ForumImageService.upload(op(a), c.id, input);
    await expect(PostService.create(op(a), other.slug, { title: '跨圈', ...rich([draft.id]) })).rejects.toMatchObject({ status: 403 });
    await PostService.edit(op(getAdmin()), p.id, { title: '管理编辑', ...rich([image.id], '修订内容') });
    expect((await ForumImageService.get(op(b), image.id)).mimeType).toBe('image/webp');
  });
  it('rich content: comment image follows parent visibility, removal, archival and account anonymization', async () => {
    const c = await circle(), a = await user(), b = await user();
    const p = await PostService.create(op(a), c.slug, { title: '旧格式帖子', body: '**仍然兼容**' });
    expect(p.bodyFormat).toBe('MARKDOWN');
    const image = await ForumImageService.upload(op(a), c.id, await png());
    const comment = await PostService.addComment(op(a), p.id, rich([image.id], ''));
    await PostService.setDeleted(op(getAdmin()), comment.id, true, true);
    await expect(ForumImageService.get(op(a), image.id)).rejects.toMatchObject({ status: 403 });
    expect((await ForumImageService.get(op(getAdmin()), image.id, true)).mimeType).toBe('image/webp');
    await PostService.setDeleted(op(getAdmin()), comment.id, false, true);
    await CircleService.setArchived(op(getAdmin()), c.id, true);
    await expect(ForumImageService.get(op(a), image.id)).rejects.toMatchObject({ status: 403 });
    await expect(ForumImageService.upload(op(a), c.id, await png())).rejects.toMatchObject({ status: 403 });
    expect((await ForumImageService.get(op(getAdmin()), image.id, true)).mimeType).toBe('image/webp');
    await CircleService.setArchived(op(getAdmin()), c.id, false);
    await deleteAccount(a.id);
    expect((await db.forumImage.findUnique({ where: { id: image.id } })).ownerId).toBeNull();
    expect((await ForumImageService.get(op(b), image.id)).data.length).toBeGreaterThan(0);
    await PostService.edit(op(getAdmin()), comment.id, rich([], '移除图片后的评论'), true);
    await expect(ForumImageService.get(op(getAdmin()), image.id, true)).rejects.toMatchObject({ status: 404 });
  });
  it('rich content: only one concurrent publication can claim a draft image', async () => {
    const c = await circle(), a = await user(), image = await ForumImageService.upload(op(a), c.id, await png());
    const results = await Promise.allSettled([1, 2].map((i) => PostService.create(op(a), c.slug, { title: `并发图文${i}`, ...rich([image.id]) })));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(await db.post.count({ where: { circleId: c.id } })).toBe(1);
  });
  it('rich content: twenty images publish in posts and comments; local drafts survive overnight', async () => {
    const c = await circle(), a = await user(), input = await png();
    const postImages = [], commentImages = [];
    for (let i = 0; i < 20; i++) {
      postImages.push((await ForumImageService.upload(op(a), c.id, input)).id);
      commentImages.push((await ForumImageService.upload(op(a), c.id, input)).id);
    }
    await db.forumImage.updateMany({ where: { id: { in: [...postImages, ...commentImages] } }, data: { createdAt: new Date(Date.now() - 2 * 86400000) } });
    expect((await ForumImageService.get(op(a), postImages[0])).mimeType).toBe('image/webp');
    const p = await PostService.create(op(a), c.slug, { title: '二十张图', ...rich(postImages) });
    const comment = await PostService.addComment(op(a), p.id, rich(commentImages));
    expect(await db.forumImage.count({ where: { postId: p.id } })).toBe(20);
    expect(await db.forumImage.count({ where: { commentId: comment.id } })).toBe(20);
    await expect(PostService.addComment(op(a), p.id, rich(Array(21).fill(postImages[0])))).rejects.toMatchObject({ status: 400 });
  });
  it('rich content: abandoned drafts expire and quota is checked before persisting another image', async () => {
    const c = await circle(), a = await user(), image = await ForumImageService.upload(op(a), c.id, await png());
    await db.forumImage.update({ where: { id: image.id }, data: { createdAt: new Date('2020-01-01') } });
    await expect(ForumImageService.get(op(a), image.id)).rejects.toMatchObject({ status: 403 });
    await expect(PostService.create(op(a), c.slug, { title: '过期草稿', ...rich([image.id]) })).rejects.toMatchObject({ status: 403 });
    const next = await ForumImageService.upload(op(a), c.id, await png());
    expect(await db.forumImage.findUnique({ where: { id: image.id } })).toBeNull();
    await db.forumImage.update({ where: { id: next.id }, data: { size: IMAGE_LIMITS.quota } });
    await expect(ForumImageService.upload(op(a), c.id, await png())).rejects.toMatchObject({ status: 400 });
    expect(await db.forumImage.count({ where: { ownerId: a.id } })).toBe(1);
  });
  it('rich image HTTP: binary upload/read, authentication, no-store, forged format rejection', async () => {
    const c = await circle(), a = await user();
    const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const root = `http://127.0.0.1:${server.address().port}/api/v1/forum`;
    const headers = { Authorization: `Bearer ${jwt.sign({ sub: a.id }, process.env.JWT_SECRET, { expiresIn: '5m' })}`, 'Content-Type': 'image/png' };
    try {
      const upload = await fetch(`${root}/circles/${c.id}/images`, { method: 'POST', headers, body: await png() });
      expect(upload.status).toBe(201); const image = (await upload.json()).data;
      expect((await fetch(`${root}/images/${image.id}`)).status).toBe(401);
      const response = await fetch(`${root}/images/${image.id}`, { headers });
      expect(response.headers.get('content-type')).toContain('image/webp'); expect(response.headers.get('cache-control')).toContain('no-store');
      expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
      expect((await fetch(`${root}/circles/${c.id}/images`, { method: 'POST', headers, body: '<svg onload="alert(1)"/>' })).status).toBe(400);
    } finally { await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }); }
  });
}
