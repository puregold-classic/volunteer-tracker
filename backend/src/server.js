import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';  // 导入 mongoose

import database from './utils/database.js';
import volunteerRoutes from './routes/volunteerRoutes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

// new added
import nonProjectRoutes from './routes/nonProjectServicesRoutes.js';

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';  // 必须监听所有接口

// 连接数据库
database;

// 安全中间件
app.use(helmet());
app.use(cors({
  origin: function (origin, callback) {
    // 允许所有Netlify域名 + 本地开发
    if (!origin || 
        origin.endsWith('.netlify.app') || 
        origin.includes('localhost') ||
        origin.includes('127.0.0.1')) {
      return callback(null, origin);
    }
    callback(new Error('CORS not allowed'));
  },
  credentials: true
}));

// 日志中间件
app.use(morgan('dev'));

// 解析请求体
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API路由
app.use('/api/v1/volunteers', volunteerRoutes);
// new added
app.use('/api/v1/non-project-services', nonProjectRoutes);

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
      
      <h3 class="section-title">非项目服务 (Non-Project Services)</h3>
      <div class="endpoint">
        <strong>GET /api/non-project-services</strong> - 获取所有服务记录
        <br><small>支持筛选: ?volunteerId=VM-xxxx&category=翻译</small>
      </div>
      <div class="endpoint">
        <strong>POST /api/non-project-services</strong> - 创建新的服务时长记录
      </div>
      <div class="endpoint">
        <strong>GET /api/non-project-services/stats/:volunteerId</strong> - 获取指定志愿者的时长汇总统计
      </div>
      <div class="endpoint">
        <strong>DELETE /api/non-project-services/:id</strong> - 删除指定的时长记录
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
  // new added
  console.log(`🛠  非项目服务API: http://localhost:${PORT}/api/v1/non-project-services`);
  console.log(`🌐 Web界面: http://localhost:${PORT}/`);
});