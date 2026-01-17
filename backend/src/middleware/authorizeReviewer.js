// src/middleware/authorizeReviewer.js
import Volunteer from '../models/Volunteer.js';

/**
 * 审核权限验证中间件
 * 验证用户是否有审核权限
 */
export const authorizeReviewer = async (req, res, next) => {
  try {
    // 从请求头或查询参数获取审核人信息
    const reviewerId = req.headers['x-reviewer-id'] || req.query.reviewerId;
    
    if (!reviewerId) {
      return res.status(401).json({
        success: false,
        error: '需要提供审核人ID',
        code: 'MISSING_REVIEWER_ID'
      });
    }
    
    // 查询审核人信息
    const reviewer = await Volunteer.findOne({ 
      id: reviewerId
    });
    
    if (!reviewer) {
      return res.status(404).json({
        success: false,
        error: '审核人不存在',
        code: 'REVIEWER_NOT_FOUND'
      });
    }
    
    // 检查审核权限（admin或c_admin角色）
    const allowedRoles = ['admin', 'c_admin'];
    if (!allowedRoles.includes(reviewer.role)) {
      return res.status(403).json({
        success: false,
        error: '没有审核权限',
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredRoles: allowedRoles,
        currentRole: reviewer.role
      });
    }
    
    // 将审核人信息附加到请求对象
    req.reviewer = {
      id: reviewer.id,
      name: reviewer.chineseName,
      role: reviewer.role
    };
    
    next();
  } catch (error) {
    console.error('审核权限验证失败:', error);
    return res.status(500).json({
      success: false,
      error: '权限验证失败',
      code: 'AUTHORIZATION_FAILED'
    });
  }
};

/**
 * 可选审核人中间件（仅记录，不强制验证）
 * 用于统计和审计，但不阻止请求
 */
export const optionalReviewer = async (req, res, next) => {
  try {
    const reviewerId = req.headers['x-reviewer-id'] || req.query.reviewerId;
    
    if (reviewerId) {
      const reviewer = await Volunteer.findOne({ 
        id: reviewerId,
      });
      
      if (reviewer && ['admin', 'c_admin'].includes(reviewer.role)) {
        req.reviewer = {
          id: reviewer.id,
          name: reviewer.chineseName,
          role: reviewer.role
        };
      }
    }
    
    next();
  } catch (error) {
    // 可选中间件，不阻止请求
    console.warn('可选审核人验证失败:', error);
    next();
  }
};