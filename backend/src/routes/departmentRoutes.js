// src/routes/departmentRoutes.js — v2.1
import express from 'express';
import DepartmentController from '../controllers/departmentController.js';
import { authenticate, authorizeRoles } from '../middleware/authenticate.js';

const router = express.Router();

// Public reads — anyone can see what departments exist
router.get('/', DepartmentController.list);
router.get('/:id', DepartmentController.getById);

// Admin-only mutations
router.post('/', authenticate, authorizeRoles('admin'), DepartmentController.create);
router.patch('/:id', authenticate, authorizeRoles('admin'), DepartmentController.update);
router.delete('/:id', authenticate, authorizeRoles('admin'), DepartmentController.remove);

export default router;
