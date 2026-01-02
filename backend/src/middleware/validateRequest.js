const { validationResult } = require('express-validator');

/**
 * 验证请求中间件
 * 如果验证失败，返回400错误
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: err.value
      }))
    });
  }
  
  next();
};

module.exports = validateRequest;
