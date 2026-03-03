import express from 'express';
import AuthController from '../controllers/authController.js';
import AdminController from '../controllers/adminController.js';
import { authenticate, authorizeRoles } from '../middleware/authenticate.js';

const router = express.Router();

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/logout', authenticate, AuthController.logout);
router.get('/me', authenticate, AuthController.me);

// 管理员创建账号（可创建admin/b_admin/user）
router.post('/accounts', authenticate, authorizeRoles('admin', 'a_admin'), AuthController.createAccountByAdmin);
router.get('/admin/accounts', authenticate, authorizeRoles('admin'), AdminController.listAccounts);
router.patch('/admin/accounts/:accountId', authenticate, authorizeRoles('admin'), AdminController.updateAccount);
router.patch('/admin/accounts/:accountId/role', authenticate, authorizeRoles('admin'), AdminController.updateAccount);
router.delete('/admin/accounts/:accountId', authenticate, authorizeRoles('admin'), AdminController.deleteAccount);
router.post('/admin/volunteers', authenticate, authorizeRoles('admin'), AdminController.createVolunteerWithAccount);
router.post('/admin/import-volunteers', authenticate, authorizeRoles('admin'), AdminController.importVolunteers);
router.post('/admin/generate-accounts', authenticate, authorizeRoles('admin'), AdminController.generateMissingAccounts);
router.post('/admin/reset-system', authenticate, authorizeRoles('admin'), AdminController.resetToSystemAdmin);

export default router;
