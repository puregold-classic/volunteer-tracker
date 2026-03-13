// src/middleware/authorizeReviewer.js
// Phase 5: Switched from Mongoose to Prisma. Shadow writes removed.

import prisma from '../utils/prismaClient.js';

export const authorizeReviewer = async (req, res, next) => {
  try {
    // Primary path: use req.user injected by authenticate middleware
    if (req.user) {
      const allowedRoles = ['admin', 'a_admin', 'b_admin'];
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: '没有审核权限',
          code: 'INSUFFICIENT_PERMISSIONS',
          requiredRoles: allowedRoles,
          currentRole: req.user.role,
        });
      }
      if (!req.user.volunteerId) {
        return res.status(400).json({
          success: false,
          error: '审核账号必须绑定volunteerId',
          code: 'MISSING_VOLUNTEER_ID',
        });
      }
      req.reviewer = {
        id: req.user.volunteerId,
        name: req.user.name || req.user.email,
        role: req.user.role,
      };
      return next();
    }

    // Legacy path: reviewer ID from header/query
    const reviewerId = req.headers['x-reviewer-id'] || req.query.reviewerId;
    if (!reviewerId) {
      return res.status(401).json({
        success: false,
        error: '需要提供审核人ID',
        code: 'MISSING_REVIEWER_ID',
      });
    }

    const reviewer = await prisma.volunteer.findFirst({ where: { volunteerId: reviewerId } });
    if (!reviewer) {
      return res.status(404).json({
        success: false,
        error: '审核人不存在',
        code: 'REVIEWER_NOT_FOUND',
      });
    }

    const allowedRoles = ['admin', 'a_admin', 'b_admin'];
    if (!allowedRoles.includes(reviewer.role)) {
      return res.status(403).json({
        success: false,
        error: '没有审核权限',
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredRoles: allowedRoles,
        currentRole: reviewer.role,
      });
    }

    req.reviewer = {
      id: reviewer.volunteerId,
      name: reviewer.chineseName,
      role: reviewer.role,
    };
    next();
  } catch (error) {
    console.error('审核权限验证失败:', error);
    return res.status(500).json({
      success: false,
      error: '权限验证失败',
      code: 'AUTHORIZATION_FAILED',
    });
  }
};

export const optionalReviewer = async (req, res, next) => {
  try {
    if (req.user && ['admin', 'a_admin', 'b_admin'].includes(req.user.role)) {
      req.reviewer = {
        id: req.user.volunteerId || req.user.accountId,
        name: req.user.name || req.user.email,
        role: req.user.role,
      };
      return next();
    }

    const reviewerId = req.headers['x-reviewer-id'] || req.query.reviewerId;
    if (reviewerId) {
      const reviewer = await prisma.volunteer.findFirst({ where: { volunteerId: reviewerId } });
      if (reviewer && ['admin', 'a_admin', 'b_admin'].includes(reviewer.role)) {
        req.reviewer = {
          id: reviewer.volunteerId,
          name: reviewer.chineseName,
          role: reviewer.role,
        };
      }
    }

    next();
  } catch (error) {
    console.warn('可选审核人验证失败:', error);
    next();
  }
};
