// src/routes/serviceItemRoutes.js — v2.1
import express from 'express';
import ServiceItemController from '../controllers/serviceItemController.js';
import { authenticate, authorizeRoles } from '../middleware/authenticate.js';

const router = express.Router();

// Public reads — anyone can see service items (needed for the support form)
router.get('/', ServiceItemController.list);
router.get('/grouped', ServiceItemController.listGrouped);
router.get('/:id', ServiceItemController.getById);

// Admin-only mutations
router.post('/', authenticate, authorizeRoles('admin'), ServiceItemController.create);
router.patch('/:id', authenticate, authorizeRoles('admin'), ServiceItemController.update);
router.delete('/:id', authenticate, authorizeRoles('admin'), ServiceItemController.remove);

export default router;
