const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');

// 获取全局统计
router.get('/summary', statsController.getSummaryStats);

// 获取月度统计
router.get('/monthly', statsController.getMonthlyStats);

// 获取服务类型统计
router.get('/services', statsController.getServiceStats);

// 获取地区分布统计
router.get('/regions', statsController.getRegionDistribution);

module.exports = router;
