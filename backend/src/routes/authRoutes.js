// src/routes/authRoutes.js — v2.1
//
// Public auth endpoints (login/register/me/logout) and admin account
// management endpoints. All single-account creation paths route through
// AccountService via AdminController.

import express from 'express';
import AuthController from '../controllers/authController.js';
import AdminController from '../controllers/adminController.js';
import { authenticate, authorizeRoles } from '../middleware/authenticate.js';
import { authLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

// Public
router.post('/register', authLimiter, AuthController.register);
router.post('/login', authLimiter, AuthController.login);
router.post('/logout', authenticate, AuthController.logout);
router.get('/me', authenticate, AuthController.me);

// v3.2: account self-service
router.post('/change-password', authenticate, AuthController.changePassword);
router.post('/me/avatar', authenticate, AuthController.updateAvatar);
// v3.8: 重置密码 admin(全局) + 部长(本部门，service 层作用域校验)
router.post('/admin/accounts/:accountId/reset-password', authenticate, authorizeRoles('admin', 'a_admin'), AuthController.adminResetPassword);

// 账号管理：v3.8 admin(全局) + 部长(本部门)。删除仍仅 admin（部长只停用）。
router.get('/admin/accounts', authenticate, authorizeRoles('admin', 'a_admin'), AdminController.listAccounts);
router.patch('/admin/accounts/:accountId', authenticate, authorizeRoles('admin', 'a_admin'), AdminController.updateAccount);
router.delete('/admin/accounts/:accountId', authenticate, authorizeRoles('admin'), AdminController.deleteAccount);
router.post('/admin/volunteers', authenticate, authorizeRoles('admin', 'a_admin'), AdminController.createVolunteerAccount);
// v3.7: 关闭"新增系统 admin"接口 —— 系统 admin 仅由启动 bootstrap 创建。
// createAdminAccount service 仍保留（供 createInitialAdmin / resetToSystemAdmin 调用），只是不再暴露 HTTP 入口。
// v3.8: 部长也可批量导入（service 层强制本部门 + 限 user/b_admin）
router.post('/admin/import-volunteers/validate', authenticate, authorizeRoles('admin', 'a_admin'), AdminController.validateVolunteersCsv);
router.post('/admin/import-volunteers', authenticate, authorizeRoles('admin', 'a_admin'), AdminController.importVolunteersCsv);
router.post('/admin/reset-system', authenticate, authorizeRoles('admin'), AdminController.resetSystem);

export default router;
