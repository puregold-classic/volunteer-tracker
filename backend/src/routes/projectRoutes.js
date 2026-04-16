// src/routes/projectRoutes.js — v3 wave 2
//
// Project CRUD. Writes (create / update / delete) gated to admin + a_admin.
// Reads are authenticated only — any logged-in user can see projects
// (needed for tagging their own records in wave 3).

import express from 'express';
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
} from '../controllers/projectController.js';
import { authenticate, authorizeRoles } from '../middleware/authenticate.js';

const router = express.Router();

router.get('/', authenticate, listProjects);
router.get('/:id', authenticate, getProject);
router.post('/', authenticate, authorizeRoles('admin', 'a_admin'), createProject);
router.patch('/:id', authenticate, authorizeRoles('admin', 'a_admin'), updateProject);
router.delete('/:id', authenticate, authorizeRoles('admin', 'a_admin'), deleteProject);

export default router;
