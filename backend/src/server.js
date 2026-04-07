// src/server.js
// Phase 5: Removed MongoDB/Mongoose dependency. PG via Prisma is now the sole database.
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import morgan from 'morgan';

import prisma from './utils/prismaClient.js';
import { createInitialAdminIfMissing } from './startup/createInitialAdmin.js';
import volunteerRoutes from './routes/volunteerRoutes.js';
import applicationRoutes from './routes/applicationRoutes.js'; // 新增
import reviewRoutes from './routes/reviewRoutes.js'; // 新增
import serviceRoutes from './routes/serviceRoutes.js'; // 新增
import auditRoutes from './routes/auditRoutes.js'; // 新增
import authRoutes from './routes/authRoutes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';  // 必须监听所有接口

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
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/applications', applicationRoutes); // 新增申请路由
app.use('/api/v1/reviews', reviewRoutes); // 新增审核路由
app.use('/api/v1/services', serviceRoutes); // 新增服务记录路由
app.use('/api/v1/audit', auditRoutes); // 新增审计日志路由

// 健康检查
app.get('/api/health', async (req, res) => {
  let pgStatus = 'unknown';
  try {
    await prisma.$queryRaw`SELECT 1`;
    pgStatus = 'connected';
  } catch {
    pgStatus = 'disconnected';
  }
  res.json({
    status: 'ok',
    message: '志愿者管理系统API正常运行',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    postgresql: pgStatus,
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
      <p>数据库: PostgreSQL (Prisma)</p>
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
const start = async () => {
  // Ensure an admin account exists (no-op if one already does). Failures are
  // logged but do not block startup — see createInitialAdmin.js for rationale.
  try {
    await createInitialAdminIfMissing();
  } catch (err) {
    console.error('[startup] admin bootstrap threw:', err);
  }

  app.listen(PORT, HOST, () => {
    console.log(`🚀 服务器运行在端口 ${PORT}`);
    console.log(`📡 健康检查: http://localhost:${PORT}/api/health`);
    console.log(`👤 志愿者API: http://localhost:${PORT}/api/v1/volunteers`);
    console.log(`📝 申请API: http://localhost:${PORT}/api/v1/applications`);
    console.log(`👮 审核API: http://localhost:${PORT}/api/v1/reviews`);
    console.log(`📊 服务记录API: http://localhost:${PORT}/api/v1/services`);
    console.log(`📜 审计日志API: http://localhost:${PORT}/api/v1/audit`);
    console.log(`📈 审计统计: http://localhost:${PORT}/api/v1/audit/stats/summary`);
    console.log(`💾 审计导出: http://localhost:${PORT}/api/v1/audit/export`);
  });
};

start();
