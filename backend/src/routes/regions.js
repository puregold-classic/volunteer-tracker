const express = require('express');
const router = express.Router();
const regionController = require('../controllers/regionController');

// 获取所有地区
router.get('/', regionController.getAllRegions);

// 获取地区统计
router.get('/stats', regionController.getRegionStats);

// 获取特定地区详情
router.get('/:id', regionController.getRegionById);

// 获取地区下的志愿者
router.get('/:id/volunteers', regionController.getRegionVolunteers);

module.exports = router;
