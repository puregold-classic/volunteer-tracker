import express from 'express';
import { DevAccountError, devAccountSwitchEnabled, listDevAccounts, switchDevAccount } from '../services/DevAccountService.js';

const router = express.Router();
router.use((_req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  if (!devAccountSwitchEnabled()) return res.status(404).json({ success: false, message: '功能不存在' });
  next();
});
const handle = (work) => async (req, res, next) => {
  try { res.json({ success: true, data: await work(req) }); }
  catch (error) {
    if (error instanceof DevAccountError) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};
router.get('/enabled', handle(() => ({ enabled: true })));
router.get('/', handle((req) => listDevAccounts(req.query.search)));
router.post('/switch', handle((req) => switchDevAccount(req.body?.accountId)));
export default router;
