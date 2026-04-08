// src/routes/supportLedgerRoutes.js — v2.1
//
// Read-only admin "项目支援台账" endpoints. Replaces v1's /api/v1/reviews.

import express from 'express';
import SupportLedgerController from '../controllers/supportLedgerController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeReviewer } from '../middleware/authorizeReviewer.js';

const router = express.Router();

router.use(authenticate, authorizeReviewer);

router.get('/overview', SupportLedgerController.overview);
router.get('/time-series', SupportLedgerController.timeSeries);
router.get('/proxy-contributions', SupportLedgerController.proxyContributions);
router.get('/recent-activity', SupportLedgerController.recentActivity);
router.get('/volunteers/:volunteerId', SupportLedgerController.volunteerDetail);

export default router;
