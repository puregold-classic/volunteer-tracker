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

const router = express.Router();

router.get('/', getAllVolunteers);
router.get('/stats', getVolunteerStats);
router.get('/:id', getVolunteerById);
router.get('/:id/derived-stats', getVolunteerDerivedStats);
router.put('/:id', authenticate, authorizeRoles('admin', 'a_admin', 'b_admin'), updateVolunteer);

export default router;
