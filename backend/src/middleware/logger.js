/**
 * 请求日志中间件
 */
const logger = (req, res, next) => {
  const start = Date.now();
  
  // 请求完成后记录日志
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ` +
      `${res.statusCode} ${duration}ms`
    );
  });
  
  next();
};

module.exports = logger;
