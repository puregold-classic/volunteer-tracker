import jwt from 'jsonwebtoken';
import Account from '../models/Account.js';

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
        code: 'MISSING_TOKEN'
      });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(500).json({
        success: false,
        error: '服务端未配置JWT_SECRET',
        code: 'JWT_SECRET_MISSING'
      });
    }

    const payload = jwt.verify(token, jwtSecret);
    const account = await Account.findById(payload.sub).lean();

    if (!account || !account.isActive) {
      return res.status(401).json({
        success: false,
        error: '账号不存在或已停用',
        code: 'ACCOUNT_INACTIVE'
      });
    }

    req.user = {
      accountId: String(account._id),
      email: account.email,
      role: account.role,
      volunteerId: account.volunteerId,
      name: account.name
    };

    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: '令牌无效或已过期',
      code: 'INVALID_TOKEN'
    });
  }
};

export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: '未登录',
        code: 'UNAUTHORIZED'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: '权限不足',
        code: 'FORBIDDEN',
        requiredRoles: allowedRoles,
        currentRole: req.user.role
      });
    }

    return next();
  };
};
