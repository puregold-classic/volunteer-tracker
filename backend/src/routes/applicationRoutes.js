// src/routes/applicationRoutes.js
import express from 'express';
import ApplicationController from '../controllers/applicationController.js';
import { validateApplicationSubmission } from '../middleware/validateApplication.js';

const router = express.Router();

// 申请验证与提交
router.post('/validate', ApplicationController.validateApplication);
router.post('/', validateApplicationSubmission, ApplicationController.submitApplication);

// 申请查询
router.get('/my', ApplicationController.getMyApplications);
router.post('/my/deactivate-all', ApplicationController.deactivateAllMyApplications);

// 申请维护
router.delete('/:applicationId', ApplicationController.withdrawApplication);

export default router;
