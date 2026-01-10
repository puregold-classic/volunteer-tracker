import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';  // 导入 mongoose

import database from './utils/database.js';
import volunteerRoutes from './routes/volunteerRoutes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';  // 必须监听所有接口

// 连接数据库
database;

// 安全中间件
app.use(helmet());
// 从环境变量读取允许的域名
const getAllowedOrigins = () => {
  // 从环境变量获取，用逗号分隔多个域名
  const envOrigins = process.env.CORS_ORIGINS || 
                    process.env.CORS_ORIGIN || 
                    'http://localhost:3000';
  
  // 分割成数组
  const origins = envOrigins.split(',').map(origin => origin.trim());
  
  // 添加固定的本地开发域名
  const defaultOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://volunteer-tracker.onrender.com', // 后端自身
  ];
  
  // 合并并去重
  return [...new Set([...origins, ...defaultOrigins])];
};

const allowedOrigins = getAllowedOrigins();

app.use(cors({
  origin: function (origin, callback) {
    // 允许没有origin的请求
    if (!origin) return callback(null, true);
    
    // 检查是否在允许列表中
    if (allowedOrigins.includes(origin) || 
        allowedOrigins.some(allowed => allowed === '*')) {
      return callback(null, origin); // 返回具体的origin，不是true
    }
    
    // 检查通配符匹配（如 *.netlify.app）
    const isWildcardMatch = allowedOrigins.some(allowed => {
      if (allowed.includes('*')) {
        const pattern = allowed.replace('.', '\\.').replace('*', '.*');
        const regex = new RegExp(`^${pattern}$`);
        return regex.test(origin);
      }
      return false;
    });
    
    if (isWildcardMatch) {
      return callback(null, origin);
    }
    
    return callback(new Error('CORS not allowed'), false);
  },
  credentials: true,
}));

// 日志中间件
app.use(morgan('dev'));

// 解析请求体
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API路由
app.use('/api/v1/volunteers', volunteerRoutes);

// 健康检查 - 修复这里
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: '志愿者管理系统API正常运行',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// 根路由
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Volunteer Tracker API</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
        .status { color: green; font-weight: bold; }
        .endpoint { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 5px; }
      </style>
    </head>
    <body>
      <h1>🚀 Volunteer Tracker Backend API</h1>
      <p class="status">✅ Server running on port ${PORT}</p>
      <p>MongoDB状态: ${mongoose.connection.readyState === 1 ? '已连接' : '未连接'}</p>
      <h2>📡 可用接口</h2>
      <div class="endpoint">
        <strong>GET /api/health</strong> - 健康检查
      </div>
      <div class="endpoint">
        <strong>GET /api/v1/volunteers</strong> - 获取所有志愿者
        <br><small>参数: ?status=在职&region=中国大陆&page=1&limit=20</small>
      </div>
      <div class="endpoint">
        <strong>GET /api/v1/volunteers/stats</strong> - 获取统计信息
      </div>
      <div class="endpoint">
        <strong>GET /api/v1/volunteers/:id</strong> - 获取单个志愿者
      </div>
    </body>
    </html>
  `);
});

// 404处理
app.use(notFound);

// 错误处理
app.use(errorHandler);

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 服务器运行在端口 ${PORT}`);
  console.log(`📡 健康检查: http://localhost:${PORT}/api/health`);
  console.log(`📊 志愿者API: http://localhost:${PORT}/api/v1/volunteers`);
  console.log(`🌐 Web界面: http://localhost:${PORT}/`);
});