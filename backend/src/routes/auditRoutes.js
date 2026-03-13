// src/routes/auditRoutes.js
import express from 'express';
import AuditController from '../controllers/auditController.js';

const router = express.Router();

// ========== 审计查询 ==========

// 获取审计日志列表
router.get('/logs', AuditController.getAuditLogs);

// 获取目标审计历史
router.get('/target/:targetType/:targetId', AuditController.getTargetAuditHistory);

// ========== 审计分析 ==========

// 审计统计总览
router.get('/stats/summary', AuditController.getAuditStatistics);

// 操作人审计统计
router.get('/stats/operator/:operatorId', AuditController.getOperatorAuditStatistics);

// 审计时间线分析
router.get('/stats/timeline', AuditController.getAuditTimelineAnalysis);

// ========== 审计导出 ==========

// 导出审计日志
router.get('/export', AuditController.exportAuditLogs);

// 获取审计日志详情（放在最后，避免拦截/export等静态路径）
router.get('/:auditId', AuditController.getAuditLogById);

export default router;
