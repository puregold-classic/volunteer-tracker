// src/routes/projectSupportRoutes.js — v2.1
//
// CRUD + state transitions for ProjectSupport records. Replaces v1's
// /api/v1/services route entirely.

import express from 'express';
import ProjectSupportController from '../controllers/projectSupportController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = express.Router();

router.use(authenticate); // all endpoints require login

// List + read
router.get('/', ProjectSupportController.list);
router.get('/me/pending', ProjectSupportController.listPendingForMe);
router.get('/:supportId', ProjectSupportController.getBySupportId);

// Mutations
router.post('/', ProjectSupportController.create);
router.patch('/:supportId', ProjectSupportController.update);
router.delete('/:supportId', ProjectSupportController.remove);

// State transitions for proxy submissions
router.post('/:supportId/confirm', ProjectSupportController.confirm);
router.post('/:supportId/reject', ProjectSupportController.reject);

export default router;
