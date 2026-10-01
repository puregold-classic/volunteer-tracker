import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/authenticate.js';
import NotificationService from '../services/NotificationService.js';
import { ForumError } from '../services/CircleService.js';
const router = express.Router();
router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); res.vary('Authorization'); next(); });
router.use(authenticate);
const limiter = rateLimit({ windowMs: 60_000, limit: 120, keyGenerator: (req) => `account:${req.user.accountId}`,
  skip: () => ['test', 'development'].includes(process.env.NODE_ENV), standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: '操作过于频繁，请稍后再试' } });
const handle = (work, paginated = false) => async (req, res, next) => {
  try { const result = await work(req); res.json({ success: true, ...(paginated ? result : { data: result }) }); }
  catch (error) { if (error instanceof ForumError) return res.status(error.status).json({ success: false, message: error.message }); next(error); }
};
router.get('/', handle((r) => NotificationService.list(r.user, r.query), true));
router.get('/unread-count', handle((r) => NotificationService.unreadCount(r.user)));
router.patch('/:id/read', limiter, handle((r) => NotificationService.markRead(r.user, r.params.id)));
router.post('/read-all', limiter, handle((r) => NotificationService.readAll(r.user, r.body || {})));
export default router;
