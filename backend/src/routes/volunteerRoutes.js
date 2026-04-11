// src/routes/volunteerRoutes.js — v2.1
//
// Read + update only here. Volunteer creation lives under /admin/volunteers
// (delegates to AccountService.createVolunteerAccount). Volunteer deletion
// happens via the account-cascade flow.

import express from 'express';
import {
  getAllVolunteers,
  getVolunteerById,
  updateVolunteer,
  getVolunteerStats,
  getVolunteerDerivedStats,
} from '../controllers/volunteerController.js';
import { authenticate, authorizeRoles } from '../middleware/authenticate.js';
import { optionalAuthenticate } from '../middleware/optionalAuth.js';

const router = express.Router();

// List + detail are public but optionalAuth populates req.user when a valid
// token is present, so the controller can decide whether to include email/phone
// based on the viewer's role or self-view status.
router.get('/', optionalAuthenticate, getAllVolunteers);
router.get('/stats', getVolunteerStats);
router.get('/:id', optionalAuthenticate, getVolunteerById);
router.get('/:id/derived-stats', getVolunteerDerivedStats);
router.put('/:id', authenticate, authorizeRoles('admin', 'a_admin', 'b_admin'), updateVolunteer);

export default router;
