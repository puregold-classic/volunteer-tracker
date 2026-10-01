import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/authenticate.js';
import CircleService, { ForumError } from '../services/CircleService.js';
import PostService from '../services/PostService.js';
import ForumInteractionService from '../services/ForumInteractionService.js';
import ForumDirectoryService from '../services/ForumDirectoryService.js';
import ForumImageService from '../services/ForumImageService.js';
import ForumMentionService from '../services/ForumMentionService.js';
import CircleAssetService from '../services/CircleAssetService.js';

const router = express.Router();
router.use((_req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  res.vary('Authorization');
  next();
});
router.use(authenticate);
const writeLimiter = rateLimit({
  windowMs: 60_000, limit: 30,
  keyGenerator: (req) => `account:${req.user.accountId}`,
  skip: () => ['test', 'development'].includes(process.env.NODE_ENV),
  standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: '操作过于频繁，请稍后再试' },
});
router.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.body != null && (typeof req.body !== 'object' || Array.isArray(req.body))) {
    return res.status(400).json({ success: false, message: '请求格式不正确' });
  }
  return writeLimiter(req, res, next);
});
// HTTP adaptation only; all authorization and state decisions live in service.
const handle = (work, status = 200, paginated = false) => async (req, res, next) => {
  try { const result = await work(req); res.status(status).json({ success: true, ...(paginated ? result : { data: result }) }); }
  catch (error) {
    if (error instanceof ForumError) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};
const assetParser = (limit) => {
  const parser = express.raw({ type: () => true, limit });
  return (req, res, next) => parser(req, res, error => {
    if (error?.type === 'entity.too.large') return res.status(413).json({ success: false, message: `文件超过 ${limit === '10mb' ? '10' : '20'} MB 上限` });
    next(error);
  });
};
router.post('/circles/:id/cover', assetParser('10mb'), handle(r => CircleAssetService.upload(r.user, r.params.id, r.body, null, true), 201));
router.get('/circles/:id/files', handle(r => CircleAssetService.list(r.user, r.params.id, r.query)));
router.post('/circles/:id/files', assetParser('20mb'), handle(r => {
  let name; try { name = decodeURIComponent(r.get('X-File-Name') || ''); } catch { throw new ForumError(400, '文件名格式不正确'); }
  return CircleAssetService.upload(r.user, r.params.id, r.body, name);
}, 201));
router.get('/assets/:id', async (req, res, next) => {
  try {
    if (req.query.view !== undefined && req.query.view !== 'manage') throw new ForumError(400, '无效的文件视图');
    const file = await CircleAssetService.get(req.user, req.params.id, req.query.view === 'manage');
    if (file.kind === 'FILE') res.attachment(file.name);
    else res.set('Content-Disposition', 'inline');
    res.set('Content-Type', file.mimeType).set('X-Content-Type-Options', 'nosniff').send(Buffer.from(file.data));
  } catch (error) {
    if (error instanceof ForumError) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
});
router.delete('/assets/:id', handle(r => CircleAssetService.setDeleted(r.user, r.params.id, true)));
router.post('/assets/:id/restore', handle(r => CircleAssetService.setDeleted(r.user, r.params.id, false)));
router.get('/circles/:id/mentions', handle(r => ForumMentionService.candidates(r.user, r.params.id, r.query.search)));
router.get('/accounts', handle((r) => CircleService.candidates(r.user, { search: r.query.search })));
const imageParser = express.raw({ type: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/octet-stream'], limit: '10mb' });
router.post('/circles/:id/images', (req, res, next) => imageParser(req, res, (error) => {
  if (error?.type === 'entity.too.large') return res.status(413).json({ success: false, message: '每张图片不能超过 10 MB' });
  next(error);
}), handle((r) => ForumImageService.upload(r.user, r.params.id, r.body), 201));
router.get('/images/:id', async (req, res, next) => {
  try {
    if (req.query.view !== undefined && req.query.view !== 'manage') throw new ForumError(400, '无效的图片视图');
    const file = await ForumImageService.get(req.user, req.params.id, req.query.view === 'manage');
    res.set('Content-Type', file.mimeType).set('Content-Disposition', 'inline').set('X-Content-Type-Options', 'nosniff').send(Buffer.from(file.data));
  } catch (error) {
    if (error instanceof ForumError) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
});
router.get('/circles', handle((r) => CircleService.list(r.user, { view: r.query.view })));
router.post('/circles', handle((r) => CircleService.create(r.user, r.body), 201));
router.get('/circles/:id/candidates', handle((r) => CircleService.candidates(r.user, { circleId: r.params.id, search: r.query.search })));
router.get('/circles/:id/manage', handle((r) => CircleService.get(r.user, r.params.id, { management: true, byId: true })));
router.get('/circles/:slug', handle((r) => CircleService.get(r.user, r.params.slug, { management: r.query.view === 'manage' })));
router.patch('/circles/:id', handle((r) => CircleService.update(r.user, r.params.id, r.body)));
router.post('/circles/:id/archive', handle((r) => CircleService.setArchived(r.user, r.params.id, true)));
router.delete('/circles/:id/archive', handle((r) => CircleService.setArchived(r.user, r.params.id, false)));
for (const [path, role] of [['owners', 'OWNER'], ['stewards', 'STEWARD']]) {
  router.put(`/circles/:id/${path}/:accountId`, handle((r) => CircleService.setRole(r.user, r.params.id, r.params.accountId, role)));
  router.delete(`/circles/:id/${path}/:accountId`, handle((r) => CircleService.setRole(r.user, r.params.id, r.params.accountId, role, true)));
}
router.post('/circles/:id/transfer', handle((r) => CircleService.transfer(r.user, r.params.id, r.body)));
router.get('/circles/:slug/posts', handle((r) => PostService.list(r.user, r.params.slug, r.query), 200, true));
router.post('/circles/:slug/posts', handle((r) => PostService.create(r.user, r.params.slug, r.body), 201));
router.get('/posts/:id', handle((r) => PostService.get(r.user, r.params.id, r.query)));
router.patch('/posts/:id', handle((r) => PostService.edit(r.user, r.params.id, r.body)));
router.delete('/posts/:id', handle((r) => PostService.setDeleted(r.user, r.params.id, true)));
router.post('/posts/:id/restore', handle((r) => PostService.setDeleted(r.user, r.params.id, false)));
router.get('/posts/:id/comments', handle((r) => PostService.comments(r.user, r.params.id, r.query), 200, true));
router.post('/posts/:id/comments', handle((r) => PostService.addComment(r.user, r.params.id, r.body), 201));
router.patch('/comments/:id', handle((r) => PostService.edit(r.user, r.params.id, r.body, true)));
router.delete('/comments/:id', handle((r) => PostService.setDeleted(r.user, r.params.id, true, true)));
router.post('/comments/:id/restore', handle((r) => PostService.setDeleted(r.user, r.params.id, false, true)));
router.get('/me/directory', handle((r) => ForumDirectoryService.get(r.user)));
router.get('/me/posts', handle((r) => PostService.mine(r.user, false, r.query), 200, true));
router.get('/me/comments', handle((r) => PostService.mine(r.user, true, r.query), 200, true));
for (const kind of ['like', 'favorite', 'pin', 'feature']) {
  const work = kind === 'like' || kind === 'favorite' ? ForumInteractionService.engage : ForumInteractionService.mark;
  router.put(`/posts/:id/${kind}`, handle((r) => work(r.user, r.params.id, kind, true)));
  router.delete(`/posts/:id/${kind}`, handle((r) => work(r.user, r.params.id, kind, false)));
}
router.put('/circles/:id/follow', handle((r) => ForumInteractionService.follow(r.user, r.params.id, true)));
router.delete('/circles/:id/follow', handle((r) => ForumInteractionService.follow(r.user, r.params.id, false)));
for (const kind of ['pin', 'favorite']) {
  router.put(`/comments/:id/${kind}`, handle(r => ForumInteractionService.comment(r.user, r.params.id, kind, true)));
  router.delete(`/comments/:id/${kind}`, handle(r => ForumInteractionService.comment(r.user, r.params.id, kind, false)));
}
router.get('/me/comment-favorites', handle(r => ForumInteractionService.commentFavorites(r.user, r.query), 200, true));
router.get('/me/favorites', handle((r) => ForumInteractionService.favorites(r.user, r.query), 200, true));
router.get('/me/circles', handle((r) => ForumInteractionService.circles(r.user, r.query), 200, true));
export default router;
