// src/middleware/validateApplication.js
import { body, validationResult } from 'express-validator';

/**
 * 申请提交的请求验证中间件
 * 使用express-validator进行基本格式验证
 */
export const validateApplicationSubmission = [
  // 基本字段验证
  body('applicationType')
    .notEmpty().withMessage('申请类型不能为空')
    .isIn(['create', 'update', 'delete']).withMessage('申请类型必须是: create, update, delete'),
  
  body('volunteerId')
    .notEmpty().withMessage('志愿者ID不能为空')
    .matches(/^[A-Z]+-\d+$/).withMessage('志愿者ID格式: 前缀-数字'),
  
  body('volunteerName')
    .notEmpty().withMessage('志愿者姓名不能为空')
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage('志愿者姓名长度2-50字符'),
  
  // 条件验证：update/delete需要targetId
  body('targetId')
    .if(body('applicationType').isIn(['update', 'delete']))
    .notEmpty().withMessage('update/delete操作必须提供目标记录ID')
    .matches(/^NPS-[A-Z]+-\d+-\d{3}$/).withMessage('目标记录ID格式: NPS-{志愿者ID}-{序号}'),
  
  // 变更数据验证
  body('changes')
    .isArray({ min: 1 }).withMessage('变更数据必须是至少包含一项的数组'),
  
  body('changes.*.field')
    .notEmpty().withMessage('变更字段不能为空')
    .isIn(['serviceDate', 'serviceType', 'duration', 'description', 'isActive']).withMessage('不允许变更的字段'),
  
  body('changes.*.from')
    .optional()
    .custom((value, { req }) => {
      // 对于update/delete，from不能为空
      const applicationType = req.body.applicationType;
      if (applicationType !== 'create' && value === undefined) {
        throw new Error('update/delete操作必须提供原始值');
      }
      return true;
    }),
  
  body('changes.*.to')
    .custom((value) => {
      if (value === undefined || value === null) {
        throw new Error('变更后值不能为空');
      }
      if (typeof value === 'string' && value.trim() === '') {
        throw new Error('变更后值不能为空');
      }
      return true;
    }),
  
  // 提交人信息验证
  body('submittedBy.id')
    .notEmpty().withMessage('提交人ID不能为空'),
  
  body('submittedBy.name')
    .notEmpty().withMessage('提交人姓名不能为空'),
  
  body('submittedBy.role')
    .notEmpty().withMessage('提交人角色不能为空')
    .isIn(['user', 'b_admin', 'a_admin', 'admin']).withMessage('无效的角色类型'),
  
  // 验证结果处理
  (req, res, next) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      // 按约定返回第一个错误
      const firstError = errors.array()[0];
      return res.status(400).json({
        success: false,
        error: firstError.msg,
        field: firstError.path,
        value: firstError.value
      });
    }
    
    next();
  }
];
