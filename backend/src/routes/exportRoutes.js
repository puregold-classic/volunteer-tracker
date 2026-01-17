// src/routes/exportRoutes.js
import express from 'express';
import ExportController from '../controllers/exportController.js';
import { validateExportRequest } from '../middleware/validateExport.js';

const router = express.Router();

// 服务记录导出
router.get('/export', validateExportRequest, ExportController.exportServices);

// 流式导出（大数据量）
router.get('/export/stream', ExportController.streamExport);

// 统计导出
router.get('/export/stats', validateExportRequest, ExportController.exportStatistics);

// 下载导入模板
router.get('/export/template', ExportController.downloadTemplate);

export default router;

// 注意：这个路由应该挂载到 /api/v1/services 路径下