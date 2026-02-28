import express from 'express';
import AuthController from '../controllers/authController.js';
import { authenticate, authorizeRoles } from '../middleware/authenticate.js';

const router = express.Router();

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/logout', authenticate, AuthController.logout);
router.get('/me', authenticate, AuthController.me);

// 管理员创建账号（可创建admin/b_admin/user）
router.post('/accounts', authenticate, authorizeRoles('admin', 'a_admin'), AuthController.createAccountByAdmin);

export default router;
