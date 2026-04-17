// src/routes/volunteerListRoutes.js — v3 wave 3
//
// Volunteer-scoped tracking lists.

import express from 'express';
import {
  listMine,
  followDefault,
  unfollowDefault,
  followerCount,
} from '../controllers/volunteerListController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = express.Router();

// Authed read/write of caller's own lists.
router.get('/mine', authenticate, listMine);

// Follow / unfollow shortcuts — default list. Lazy-creates the list.
router.post('/follow/:volunteerId', authenticate, followDefault);
router.delete('/follow/:volunteerId', authenticate, unfollowDefault);

// Public-ish — follower count for a volunteer (feeds badge on detail page).
router.get('/volunteers/:volunteerId/follower-count', authenticate, followerCount);

export default router;
