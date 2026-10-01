import { it, expect } from 'vitest';
import sharp from 'sharp';
import jwt from 'jsonwebtoken';
import { app } from '../src/server.js';
import CircleAssetService from '../src/services/CircleAssetService.js';
import ForumMentionService from '../src/services/ForumMentionService.js';
import CircleService from '../src/services/CircleService.js';
import PostService from '../src/services/PostService.js';
import NotificationService from '../src/services/NotificationService.js';
import { deleteAccount } from '../src/services/AccountService.js';
export function registerAssetMentionTests({ db, user, circle, getAdmin }) {
  const op = a => ({ accountId: a.id });
  const rich = (...ids) => ({ bodyFormat: 'RICH_TEXT', body: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: ids.map(accountId => ({ type: 'mention', attrs: { accountId, label: '伪造名称' } })) }] }) });
  it('circle assets: staff-only writes, private history, archive read-only and anonymized uploaders', async () => {
    const c = await circle(), a = await user(), reader = await user('a_admin'), other = await circle();
    await db.circleRoleAssignment.create({ data: { accountId: a.id, circleId: c.id, role: 'STEWARD' } });
    for (const [actor, target] of [[reader, c], [a, other]]) await expect(CircleAssetService.upload(op(actor), target.id, Buffer.from('hi'), '资料.txt')).rejects.toMatchObject({ status: 403 });
    const file = await CircleAssetService.upload(op(a), c.id, Buffer.from('共享资料'), '资料.txt');
    expect(file).not.toHaveProperty('data');
    expect(Buffer.from((await CircleAssetService.get(op(reader), file.id)).data).toString()).toBe('共享资料');
    await CircleAssetService.setDeleted(op(a), file.id, true);
    expect((await CircleAssetService.list(op(reader), c.id)).total).toBe(0);
    await expect(CircleAssetService.get(op(reader), file.id)).rejects.toMatchObject({ status: 404 });
    expect((await CircleAssetService.list(op(a), c.id, { view: 'manage' })).total).toBe(1);
    expect((await CircleAssetService.get(op(a), file.id, true)).name).toBe('资料.txt');
    await CircleAssetService.setDeleted(op(a), file.id, false);
    const png = await sharp({ create: { width: 20, height: 10, channels: 3, background: '#c88742' } }).png().toBuffer();
    const first = await CircleAssetService.upload(op(a), c.id, png, null, true);
    const results = await Promise.all([1, 2].map(() => CircleAssetService.upload(op(a), c.id, png, null, true)));
    expect(results).toHaveLength(2);
    expect(await db.circleAsset.count({ where: { circleId: c.id, kind: 'COVER', deletedAt: null } })).toBe(1);
    await expect(CircleAssetService.get(op(a), first.id, true)).rejects.toMatchObject({ status: 404 });
    expect((await CircleService.get(op(reader), c.slug)).coverId).toBeTruthy();
    await CircleService.setArchived(op(getAdmin()), c.id, true);
    await expect(CircleAssetService.get(op(reader), file.id)).rejects.toMatchObject({ status: 403 });
    expect((await CircleAssetService.get(op(a), file.id, true)).name).toBe('资料.txt');
    await expect(CircleAssetService.setDeleted(op(getAdmin()), file.id, true)).rejects.toMatchObject({ status: 403 });
    await CircleService.setArchived(op(getAdmin()), c.id, false);
    await deleteAccount(a.id);
    expect((await CircleAssetService.get(op(reader), file.id)).uploader).toMatchObject({ name: '已注销' });
    for (const name of ['../secret.txt', 'a.html', 'a\r\n.txt']) await expect(CircleAssetService.upload(op(getAdmin()), c.id, Buffer.from('x'), name)).rejects.toMatchObject({ status: 400 });
  });
  it('mentions: canonical identities, recipient privacy, deduplication, edit additions and hidden content cleanup', async () => {
    const c = await circle(), a = await user(), b = await user(), d = await user();
    const candidates = await ForumMentionService.candidates(op(a), c.id, b.name);
    expect(candidates.some(row => row.accountId === b.id)).toBe(true);
    expect(candidates[0]).not.toHaveProperty('email');
    const p = await PostService.create(op(a), c.slug, { title: '提及', ...rich(b.id, b.id, a.id) });
    expect(p.body).not.toContain('伪造名称');
    expect(await db.notification.count({ where: { postId: p.id, type: 'MENTION' } })).toBe(1);
    await PostService.edit(op(a), p.id, { title: '补充', ...rich(b.id, d.id) });
    expect(await db.notification.count({ where: { postId: p.id, type: 'MENTION' } })).toBe(2);
    await PostService.edit(op(a), p.id, { title: '移除', ...rich(d.id) });
    await PostService.edit(op(a), p.id, { title: '再次提及', ...rich(b.id, d.id) });
    expect(await db.notification.count({ where: { postId: p.id, type: 'MENTION' } })).toBe(2);
    const comment = await PostService.addComment(op(b), p.id, rich(a.id));
    expect(await db.notification.count({ where: { targetId: comment.id } })).toBe(1);
    expect((await NotificationService.list(op(a))).data.find(row => row.type === 'MENTION')).toMatchObject({ summary: '在评论中提及了你', href: expect.stringContaining(`commentId=${comment.id}`) });
    await PostService.setDeleted(op(b), comment.id, true, true);
    expect(await db.notification.count({ where: { targetId: comment.id } })).toBe(0);
    await expect(PostService.addComment(op(a), p.id, rich('nonexistent-account'))).rejects.toMatchObject({ status: 400 });
    await CircleService.setArchived(op(getAdmin()), c.id, true);
    expect(await db.notification.count({ where: { postId: p.id, type: 'MENTION' } })).toBe(0);
    await expect(ForumMentionService.candidates(op(a), c.id, '')).rejects.toMatchObject({ status: 403 });
  });
  it('circle files HTTP: authenticates, forces downloads, bounds requests and storage', async () => {
    const c = await circle(), admin = getAdmin();
    const server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
    const root = `http://127.0.0.1:${server.address().port}/api/v1/forum`;
    const headers = { Authorization: `Bearer ${jwt.sign({ sub: admin.id }, process.env.JWT_SECRET, { expiresIn: '5m' })}`, 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent('资料.txt') };
    try {
      const response = await fetch(`${root}/circles/${c.id}/files`, { method: 'POST', headers, body: '保存原始字节' });
      expect(response.status).toBe(201); const file = (await response.json()).data;
      expect((await fetch(`${root}/assets/${file.id}`)).status).toBe(401);
      const download = await fetch(`${root}/assets/${file.id}`, { headers });
      expect(download.headers.get('content-disposition')).toContain('attachment');
      expect(download.headers.get('content-type')).toContain('application/octet-stream');
      expect(download.headers.get('x-content-type-options')).toBe('nosniff');
      expect(download.headers.get('cache-control')).toContain('no-store');
      expect(await download.text()).toBe('保存原始字节');
      expect((await fetch(`${root}/circles/${c.id}/files`, { method: 'POST', headers, body: Buffer.alloc(20 * 1024 * 1024 + 1) })).status).toBe(413);
      expect((await fetch(`${root}/circles/${c.id}/files`, { method: 'POST', headers: { ...headers, 'X-File-Name': '%' }, body: 'x' })).status).toBe(400);
      await db.circleAsset.update({ where: { id: file.id }, data: { size: 256 * 1024 * 1024 } });
      await expect(CircleAssetService.upload(op(admin), c.id, Buffer.from('x'), 'full.txt')).rejects.toMatchObject({ status: 400 });
    } finally { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); }
  });

}
