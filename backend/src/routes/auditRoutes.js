// src/routes/auditRoutes.js — v2.1
import express from 'express';
import AuditController from '../controllers/auditController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeReviewer } from '../middleware/authorizeReviewer.js';

const router = express.Router();

router.use(authenticate, authorizeReviewer);

router.get('/logs', AuditController.getAuditLogs);
router.get('/target/:targetType/:targetId', AuditController.getTargetAuditHistory);
router.get('/stats/summary', AuditController.getAuditStatistics);
router.get('/:auditId', AuditController.getAuditLogById);

export default router;
