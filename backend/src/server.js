import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// 中间件
app.use(cors());
app.use(express.json());

// 测试路由 - 注意路径是 '/api/health'
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// 测试路由 - 根路径
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Volunteer Tracker API</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; }
        .container { max-width: 800px; margin: 0 auto; }
        .status { color: green; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚀 Volunteer Tracker Backend API</h1>
        <p class="status">✅ Server is running on port ${PORT}</p>
        <p>Available endpoints:</p>
        <ul>
          <li><a href="/api/health">/api/health</a> - Health check</li>
          <li>/api/volunteers - Get all volunteers (coming soon)</li>
          <li>/api/volunteers/:id - Get single volunteer (coming soon)</li>
        </ul>
      </div>
    </body>
    </html>
  `);
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🌐 Web interface: http://localhost:${PORT}/`);
});