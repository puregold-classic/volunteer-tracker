// src/routes/supportLedgerRoutes.js — v2.1
//
// Read-only admin "项目服务台账" endpoints. Replaces v1's /api/v1/reviews.

import express from 'express';
import SupportLedgerController from '../controllers/supportLedgerController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeReviewer } from '../middleware/authorizeReviewer.js';

const router = express.Router();

// Auth required on every endpoint; reviewer gate only on the admin-only
// aggregates. The two "drill data" endpoints (volunteer→services,
// service→volunteers) feed the shared ScrollableBarChart drill used by
// both ReviewPage (reviewer-only) and MePage "我的关注" section (any
// authed user), so they gate on authenticate only.
router.use(authenticate);

router.get('/overview', authorizeReviewer, SupportLedgerController.overview);
router.get('/time-series', authorizeReviewer, SupportLedgerController.timeSeries);
router.get('/category-breakdown', authorizeReviewer, SupportLedgerController.categoryBreakdown);
router.get('/proxy-contributions', authorizeReviewer, SupportLedgerController.proxyContributions);
router.get('/recent-activity', authorizeReviewer, SupportLedgerController.recentActivity);
router.get('/volunteers/:volunteerId', authorizeReviewer, SupportLedgerController.volunteerDetail);

// Auth-only (any logged-in user can drill) — used by MePage follow section
router.get('/volunteers/:volunteerId/services', SupportLedgerController.volunteerServices);
router.get('/service-items/:serviceItemId/volunteers', SupportLedgerController.serviceVolunteers);

export default router;
