import express from 'express';
import { authenticate } from '../middleware/authenticate.js';
import LabelService from '../services/LabelService.js';
import { LedgerError } from '../utils/ledgerPolicy.js';

const initialize = () => {
  const router = express.Router();
  router.use(authenticate);
  router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  return router;
};
const handle = (work, status = 200) => async (req, res, next) => {
  try { res.status(status).json({ success: true, data: await work(req) }); }
  catch (error) {
    if (error instanceof LedgerError) return res.status(error.status).json({ success: false, error: error.message, message: error.message });
    next(error);
  }
};
const router = initialize();
router.get('/', handle(() => LabelService.groups()));
router.get('/bound/:serviceItemId', handle((r) => LabelService.bound(r.params.serviceItemId)));
router.get('/:id', handle(async (r) => (await LabelService.groups()).find((g) => g.id === r.params.id) || null));
router.get('/:groupId/tags', handle(async (r) => (await LabelService.groups()).find((g) => g.id === r.params.groupId)?.tags || []));
router.post('/', handle((r) => LabelService.saveGroup(r.user, null, r.body), 201));
router.patch('/:id', handle((r) => LabelService.saveGroup(r.user, r.params.id, r.body)));
// Archive configuration, retaining historical associations.
router.delete('/:id', handle((r) => LabelService.archiveGroup(r.user, r.params.id)));
export default router;

export const tagRouter = initialize();
tagRouter.get('/records/:supportId', handle((r) => LabelService.record(r.user, r.params.supportId)));
tagRouter.put('/records/:supportId', handle((r) => LabelService.replace(r.user, r.params.supportId, r.body.tagIds)));
tagRouter.post('/', handle((r) => LabelService.saveTag(r.user, null, r.body), 201));
tagRouter.patch('/:id', handle((r) => LabelService.saveTag(r.user, r.params.id, r.body)));
tagRouter.delete('/:id', handle((r) => LabelService.saveTag(r.user, r.params.id, { isActive: false })));
tagRouter.get('/:tagId', handle((r) => LabelService.detail(r.user, r.params.tagId, r.query)));
tagRouter.get('/:tagId/supports', handle(async (r) => (await LabelService.detail(r.user, r.params.tagId, r.query)).records.map((support) => ({ support }))));
tagRouter.get('/:tagId/candidates', handle((r) => LabelService.candidates(r.user, r.params.tagId, r.query)));
tagRouter.post('/:tagId/attach', handle((r) => LabelService.link(r.user, r.params.tagId, r.body.supportId)));
tagRouter.delete('/:tagId/attach/:supportId', handle((r) => LabelService.link(r.user, r.params.tagId, r.params.supportId, true)));
// Never leave legacy record-changing paths writable after introducing sessions.
tagRouter.all('/:tagId/batch/:operation', (_req, res) => res.status(410).json({ success: false, error: '旧批量入口已停用。受训名单请进入培训考勤，普通标签请关联已有记录。' }));
