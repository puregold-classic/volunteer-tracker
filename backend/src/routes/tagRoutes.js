// src/routes/tagRoutes.js — v3.2
//
// Tag + TagGroup HTTP surface. Mounts at /api/v1/tags (for tag ops) and
// /api/v1/tag-groups (for group ops). Batch endpoints are under the tag
// namespace because they're fundamentally tag-scoped.

import express from 'express';
import * as TC from '../controllers/tagController.js';
import { authenticate, authorizeRoles } from '../middleware/authenticate.js';

const router = express.Router();

router.use(authenticate);

// ─── Group CRUD (admin only, except list/read) ──
router.get('/',                    TC.listGroups);
router.get('/bound/:serviceItemId', TC.groupsBoundTo);
router.get('/:id',                 TC.getGroup);
router.post('/',                   authorizeRoles('admin'),              TC.createGroup);
router.patch('/:id',               authorizeRoles('admin'),              TC.updateGroup);
router.delete('/:id',              authorizeRoles('admin'),              TC.deleteGroup);

// Tags inside a group
router.get('/:groupId/tags',       TC.listTagsByGroup);

export default router;

// ─── Tag-level router — mounted at /api/v1/tags ──

export const tagRouter = express.Router();
tagRouter.use(authenticate);

// Tag CRUD
tagRouter.post('/',                authorizeRoles('admin', 'a_admin'),     TC.createTag);
tagRouter.patch('/:id',            authorizeRoles('admin', 'a_admin'),     TC.updateTag);
tagRouter.delete('/:id',           authorizeRoles('admin', 'a_admin'),     TC.deleteTag);

// Attach / detach (any authed; service layer enforces owner vs admin)
tagRouter.post('/:tagId/attach',                                           TC.attachTag);
tagRouter.delete('/:tagId/attach/:supportId',                              TC.detachTag);

// Tag → supports list
tagRouter.get('/:tagId/supports',                                          TC.listTagSupports);

// Batch ops (a_admin+)
tagRouter.post('/:tagId/batch/create',  authorizeRoles('admin', 'a_admin'), TC.batchCreate);
tagRouter.post('/:tagId/batch/update',  authorizeRoles('admin', 'a_admin'), TC.batchUpdate);
tagRouter.post('/:tagId/batch/delete',  authorizeRoles('admin', 'a_admin'), TC.batchDelete);
tagRouter.post('/:tagId/batch/attach',  authorizeRoles('admin', 'a_admin'), TC.batchAttach);
tagRouter.post('/:tagId/batch/detach',  authorizeRoles('admin', 'a_admin'), TC.batchDetach);
