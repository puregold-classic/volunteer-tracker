import express from 'express';
import { authenticate } from '../middleware/authenticate.js';
import TrainingService from '../services/TrainingService.js';
import { LedgerError } from '../utils/ledgerPolicy.js';

const router = express.Router();
router.use(authenticate);
router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
const handle = (work, status = 200) => async (req, res, next) => {
  try { res.status(status).json({ success: true, data: await work(req) }); }
  catch (error) {
    if (error instanceof LedgerError) return res.status(error.status).json({ success: false, error: error.message, message: error.message, details: error.details });
    next(error);
  }
};
router.get('/', handle((r) => TrainingService.list(r.user, r.query)));
router.post('/', handle((r) => TrainingService.create(r.user, r.body), 201));
router.get('/:id', handle((r) => TrainingService.detail(r.user, r.params.id, r.query)));
router.patch('/:id', handle((r) => TrainingService.update(r.user, r.params.id, r.body)));
router.get('/:id/search', handle((r) => TrainingService.search(r.user, r.params.id, r.query)));
router.post('/:id/validate', handle((r) => TrainingService.validate(r.user, r.params.id, r.body)));
router.post('/:id/members', handle((r) => TrainingService.add(r.user, r.params.id, r.body)));
router.post('/:id/members/:volunteerId/remove', handle((r) => TrainingService.setRemoved(r.user, r.params.id, r.params.volunteerId, r.body, true)));
router.post('/:id/members/:volunteerId/restore', handle((r) => TrainingService.setRemoved(r.user, r.params.id, r.params.volunteerId, r.body, false)));
export default router;
