// src/middleware/authenticate.js
// Phase 5: Switched from Mongoose Account.findById() to Prisma.
// NOTE: Existing JWT tokens issued before the PG cutover carry a MongoDB ObjectId
// in the `sub` claim. These tokens will fail (account not found) and users will
// need to re-login to receive a new token with the PG cuid as `sub`.

import jwt from 'jsonwebtoken';
import prisma from '../utils/prismaClient.js';

const extractToken = (req) => {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7).trim();
};

export const authenticate = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        error: '缺少访问令牌',
        code: 'MISSING_TOKEN',
      });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(500).json({
        success: false,
        error: '服务端未配置JWT_SECRET',
        code: 'JWT_SECRET_MISSING',
      });
    }

    const payload = jwt.verify(token, jwtSecret);

    const account = await prisma.account.findUnique({
      where: { id: payload.sub },
    });

    if (!account || !account.isActive) {
      return res.status(401).json({
        success: false,
        error: '账号不存在或已停用',
        code: 'ACCOUNT_INACTIVE',
      });
    }

    // Lightweight JWT revocation: reject tokens issued before tokenValidAfter.
    // jwt.sign() puts iat (issued-at) in seconds; Date.getTime() is ms.
    if (account.tokenValidAfter) {
      const iatMs = (payload.iat || 0) * 1000;
      if (iatMs < account.tokenValidAfter.getTime()) {
        return res.status(401).json({
          success: false,
          error: '令牌已失效，请重新登录',
          code: 'TOKEN_REVOKED',
        });
      }
    }

    req.user = {
      accountId: account.id,
      email: account.email,
      role: account.role,
      volunteerId: account.volunteerId,
      name: account.name,
    };

    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: '令牌无效或已过期',
      code: 'INVALID_TOKEN',
    });
  }
};

export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: '未登录',
        code: 'UNAUTHORIZED',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: '权限不足',
        code: 'FORBIDDEN',
        requiredRoles: allowedRoles,
        currentRole: req.user.role,
      });
    }

    return next();
  };
};
