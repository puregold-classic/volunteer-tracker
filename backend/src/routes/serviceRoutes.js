// src/routes/serviceRoutes.js
import express from 'express';
import ServiceController from '../controllers/serviceController.js';
import ExportController from '../controllers/exportController.js'; // 新增
import { validateExportRequest } from '../middleware/validateExport.js'; // 新增

const router = express.Router();

// ========== 服务记录查询 ==========

// 获取服务记录列表
router.get('/', ServiceController.getServiceRecords);

// 获取服务记录详情
router.get('/:serviceId', ServiceController.getServiceRecordById);

// 获取志愿者的服务记录
router.get('/volunteer/:volunteerId', ServiceController.getServicesByVolunteer);

// 搜索服务记录
router.get('/search', ServiceController.searchServices);

// ========== 服务记录统计 ==========

// 服务记录总览统计
router.get('/stats/summary', ServiceController.getServiceStatistics);

// 志愿者服务统计
router.get('/stats/volunteer/:volunteerId', ServiceController.getVolunteerServiceStatistics);

// 地区服务统计
router.get('/stats/region/:region', ServiceController.getRegionServiceStatistics);

// 服务趋势统计
router.get('/stats/trend', ServiceController.getServiceTrendStatistics);

// ========== 服务记录导出 ==========

// 服务记录导出
router.get('/export', validateExportRequest, ExportController.exportServices);

// 流式导出（大数据量）
router.get('/export/stream', ExportController.streamExport);

// 统计导出
router.get('/export/stats', validateExportRequest, ExportController.exportStatistics);

// 下载导入模板
router.get('/export/template', ExportController.downloadTemplate);

export default router;