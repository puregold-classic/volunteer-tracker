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
router.post('/admin/accounts/:accountId/reset-password', authenticate, authorizeRoles('admin'), AuthController.adminResetPassword);

// Admin-only account management
router.get('/admin/accounts', authenticate, authorizeRoles('admin'), AdminController.listAccounts);
router.patch('/admin/accounts/:accountId', authenticate, authorizeRoles('admin'), AdminController.updateAccount);
router.delete('/admin/accounts/:accountId', authenticate, authorizeRoles('admin'), AdminController.deleteAccount);
router.post('/admin/volunteers', authenticate, authorizeRoles('admin'), AdminController.createVolunteerAccount);
router.post('/admin/admins', authenticate, authorizeRoles('admin'), AdminController.createAdminAccount);
router.post('/admin/import-volunteers', authenticate, authorizeRoles('admin'), AdminController.importVolunteersCsv);
router.post('/admin/reset-system', authenticate, authorizeRoles('admin'), AdminController.resetSystem);

export default router;
