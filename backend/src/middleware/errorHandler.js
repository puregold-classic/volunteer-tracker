// src/middleware/errorHandler.js
// Phase 5: Added Prisma error handling, removed Mongoose references

// 404中间件
export const notFound = (req, res, next) => {
  const error = new Error(`未找到路由 - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

/**
 * 解析 Prisma 错误并返回友好的中文消息
 */
const parsePrismaError = (err) => {
  // Prisma Client Known Request Errors
  if (err.code) {
    switch (err.code) {
      case 'P2000':
        return '输入值过长，请检查字段长度限制';
      case 'P2001':
        return '记录不存在';
      case 'P2002':
        return '记录已存在（唯一约束冲突）';
      case 'P2003':
        return '外键约束冲突';
      case 'P2004':
        return '数据库约束错误';
      case 'P2005':
        return '字段值无效';
      case 'P2006':
        return '字段值无效';
      case 'P2007':
        return '数据验证错误';
      case 'P2011':
        return '必填字段缺失';
      case 'P2012':
        return '必填字段缺失';
      case 'P2013':
        return '必填字段缺失';
      case 'P2014':
        return '关系约束冲突';
      case 'P2015':
        return '关联记录不存在';
      case 'P2016':
        return '查询解析错误';
      case 'P2017':
        return '关系查询错误';
      case 'P2018':
        return '关联记录不存在';
      case 'P2025':
        return '记录不存在，无法操作';
      case 'P2026':
        return '数据库特性不支持此查询';
      case 'P2027':
        return '数据库查询错误';
      default:
        return null; // 未识别的 Prisma 错误
    }
  }
  return null;
};

// 全局错误处理中间件
export const errorHandler = (err, req, res, _next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;

  // Prisma 错误处理
  const prismaMessage = parsePrismaError(err);
  if (prismaMessage) {
    message = prismaMessage;
    if (err.code === 'P2001' || err.code === 'P2025') {
      statusCode = 404;
    } else if (err.code === 'P2002') {
      statusCode = 409; // Conflict
    } else {
      statusCode = 400;
    }
  }

  // Mongoose 错误处理（兼容旧代码残留）
  if (err.name === 'CastError') {
    message = '资源未找到';
    statusCode = 404;
  }

  if (err.name === 'ValidationError') {
    message = Object.values(err.errors).map(val => val.message).join(', ');
    statusCode = 400;
  }

  if (err.code === 11000) {
    message = '资源已存在';
    statusCode = 400;
  }

  // JWT 错误处理
  if (err.name === 'JsonWebTokenError') {
    message = '令牌无效';
    statusCode = 401;
  }
  if (err.name === 'TokenExpiredError') {
    message = '令牌已过期';
    statusCode = 401;
  }

  res.status(statusCode).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    timestamp: new Date().toISOString()
  });
};
