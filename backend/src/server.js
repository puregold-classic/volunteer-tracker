import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';  // 导入 mongoose
import fetch from 'node-fetch'; // 需要安装: npm install node-fetch

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
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// 日志中间件
app.use(morgan('dev'));

// 解析请求体
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API路由
app.use('/api/v1/volunteers', volunteerRoutes);

// IP检测端点
app.get('/api/ip-info', async (req, res) => {
  try {
    // 获取公网IP
    const ipServices = [
      'https://api.ipify.org?format=json',
      'https://icanhazip.com',
      'https://checkip.amazonaws.com'
    ];
    
    let publicIp = '未知';
    
    for (const service of ipServices) {
      try {
        const response = await fetch(service, { timeout: 3000 });
        let ip;
        
        if (service.includes('ipify')) {
          const data = await response.json();
          ip = data.ip;
        } else {
          ip = (await response.text()).trim();
        }
        
        if (ip && ip !== '') {
          publicIp = ip;
          break;
        }
      } catch (e) {
        console.log(`服务 ${service} 失败: ${e.message}`);
      }
    }
    
    // 返回详细信息
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      
      // IP信息
      ipInfo: {
        publicIp: publicIp,
        requestIp: req.ip,
        xForwardedFor: req.headers['x-forwarded-for'],
        xRealIp: req.headers['x-real-ip'],
      },
      
      // Render信息
      renderInfo: {
        isRender: !!process.env.RENDER,
        externalUrl: process.env.RENDER_EXTERNAL_URL,
        serviceId: process.env.RENDER_SERVICE_ID,
        serviceName: process.env.RENDER_SERVICE_NAME,
      },
      
      // MongoDB信息（安全显示）
      mongodbInfo: {
        configured: !!process.env.MONGODB_URI,
        uriStartsWithMongo: process.env.MONGODB_URI ? 
          (process.env.MONGODB_URI.startsWith('mongodb://') || 
           process.env.MONGODB_URI.startsWith('mongodb+srv://')) : false,
        uriLength: process.env.MONGODB_URI?.length || 0,
        // 不显示完整的URI
      },
      
      // 下一步操作
      nextSteps: [
        `1. 将此IP添加到MongoDB Atlas白名单: ${publicIp}/32`,
        '2. 如果IP是"未知"，请检查网络连接',
        '3. 添加后等待2分钟生效',
        '4. 重新访问健康检查端点'
      ]
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      advice: '请手动访问 https://api.ipify.org 查看IP'
    });
  }
});

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