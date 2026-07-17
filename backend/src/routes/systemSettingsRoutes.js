// src/routes/systemSettingsRoutes.js — v2.1
import express from 'express';
import SystemSettingsController from '../controllers/systemSettingsController.js';
import { authenticate, authorizeRoles } from '../middleware/authenticate.js';

const router = express.Router();

router.get('/', SystemSettingsController.get);
router.post('/lock', authenticate, authorizeRoles('admin'), SystemSettingsController.setLockedBefore);

export default router;
