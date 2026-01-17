// src/routes/reviewRoutes.js (更新版)
import express from 'express';
import ReviewController from '../controllers/reviewController.js';
import { authorizeReviewer } from '../middleware/authorizeReviewer.js';

const router = express.Router();

// 所有审核路由都需要验证审核权限
router.use(authorizeReviewer);

// ========== 审核查询 ==========
router.get('/pending', ReviewController.getPendingApplications);
router.get('/processed', ReviewController.getProcessedApplications);
router.get('/stats', ReviewController.getReviewStats);
router.get('/application/:applicationId', ReviewController.getApplicationForReview);

// ========== 审核操作 ==========
// 单个审核
router.post('/:applicationId', ReviewController.processApplicationReview);

// 按类型审核（保持向后兼容）
router.post('/create/:applicationId', ReviewController.processApplicationReview);
router.post('/update/:applicationId', ReviewController.processApplicationReview);
router.post('/delete/:applicationId', ReviewController.processApplicationReview);

// 批量审核
router.post('/batch', ReviewController.batchReviewApplications);

// 重审与撤回
router.post('/:reviewId/reopen', ReviewController.reopenReview);
router.delete('/:reviewId', ReviewController.withdrawReview);

export default router;