const express = require('express');
const router = express.Router();
const { body, query, param } = require('express-validator');
const volunteerController = require('../controllers/volunteerController');
const validateRequest = require('../middleware/validateRequest');

// 获取所有志愿者（带筛选）
router.get('/', [
  query('status').optional().isIn(['active', 'inactive', 'pending']),
  query('region').optional().isString().trim(),
  query('service').optional().isString().trim(),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
], validateRequest, volunteerController.getAllVolunteers);

// 获取单个志愿者
router.get('/:id', [
  param('id').isMongoId()
], validateRequest, volunteerController.getVolunteerById);

// 创建志愿者
router.post('/', [
  body('chineseName').isString().trim().notEmpty(),
  body('englishName').optional().isString().trim(),
  body('status').isIn(['active', 'inactive', 'pending']),
  body('region').isString().trim().notEmpty(),
  body('services').isArray(),
  body('services.*').isString().trim(),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().isString().trim(),
  body('totalHours').optional().isFloat({ min: 0 }),
  body('serviceCount').optional().isInt({ min: 0 })
], validateRequest, volunteerController.createVolunteer);

// 更新志愿者
router.put('/:id', [
  param('id').isMongoId(),
  body('chineseName').optional().isString().trim().notEmpty(),
  body('status').optional().isIn(['active', 'inactive', 'pending']),
  body('services').optional().isArray(),
  body('services.*').optional().isString().trim()
], validateRequest, volunteerController.updateVolunteer);

// 删除志愿者
router.delete('/:id', [
  param('id').isMongoId()
], validateRequest, volunteerController.deleteVolunteer);

// 按地区获取志愿者
router.get('/region/:regionId', [
  param('regionId').isString().trim().notEmpty()
], validateRequest, volunteerController.getVolunteersByRegion);

module.exports = router;
