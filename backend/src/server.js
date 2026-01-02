const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');

// 加载环境变量
dotenv.config({ 
  path: path.resolve(process.cwd(), `.env.${process.env.NODE_ENV || 'development'}.local`)
});
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_PREFIX = process.env.API_PREFIX || '/api/v1';

// 导入数据库
const database = require('./utils/database');

// 中间件配置
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// 健康检查端点
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await database.healthCheck();
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      database: dbHealth,
      version: '0.1.0'
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// API 路由
app.use(`${API_PREFIX}/volunteers`, require('./routes/volunteers'));
app.use(`${API_PREFIX}/regions`, require('./routes/regions'));
app.use(`${API_PREFIX}/stats`, require('./routes/stats'));

// 404 处理
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;
  
  res.status(statusCode).json({
    error: err.name || 'ServerError',
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// 启动服务器
async function startServer() {
  try {
    // 连接数据库
    await database.connect();
    
    const server = app.listen(PORT, () => {
      console.log(`
🚀 志愿者管理系统后端已启动（使用 MongoDB）
├─ 环境: ${process.env.NODE_ENV || 'development'}
├─ 地址: http://localhost:${PORT}
├─ API前缀: ${API_PREFIX}
├─ 数据库: ${process.env.MONGODB_URI}
├─ 健康检查: http://localhost:${PORT}/health
└─ 时间: ${new Date().toLocaleString()}
      `);
    });
    
    return server;
  } catch (error) {
    console.error('❌ 服务器启动失败:', error.message);
    console.log('\n💡 故障排除:');
    console.log('1. 确保 MongoDB 服务正在运行');
    console.log('2. 检查环境变量 MONGODB_URI 是否正确');
    console.log('3. 尝试重启 MongoDB 服务');
    process.exit(1);
  }
}

// 如果是直接运行此文件
if (require.main === module) {
  startServer();
}

module.exports = app;
