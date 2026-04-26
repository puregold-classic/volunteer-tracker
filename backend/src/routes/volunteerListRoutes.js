// src/routes/volunteerListRoutes.js — v3.4 multi-list
//
// Volunteer-scoped tracking lists.  All endpoints gated by authorizeListOwner
// (a_admin / b_admin with volunteer binding).  followerCount is the only
// public-ish exception — any authenticated user can hit it for the badge,
// even if they themselves can't own lists.

import express from 'express';
import {
  listMine,
  followDefault,
  unfollowDefault,
  followerCount,
  createList,
  renameList,
  deleteList,
  addMember,
  removeMember,
  updateMemberNote,
} from '../controllers/volunteerListController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeListOwner } from '../middleware/authorizeListOwner.js';

const router = express.Router();

// follower-count badge — auth only, no role gate (read-only public-ish).
router.get('/volunteers/:volunteerId/follower-count', authenticate, followerCount);

// All list-owner endpoints below require admin_a / admin_b with volunteer binding.
router.use(authenticate, authorizeListOwner);

router.get('/mine', listMine);

router.post('/', createList);
router.patch('/:listId', renameList);
router.delete('/:listId', deleteList);

router.post('/follow/:volunteerId', followDefault);
router.delete('/follow/:volunteerId', unfollowDefault);

router.post('/:listId/members/:volunteerId', addMember);
router.delete('/:listId/members/:volunteerId', removeMember);
router.patch('/:listId/members/:volunteerId', updateMemberNote);

export default router;
