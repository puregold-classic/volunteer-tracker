# 项目结构指南

## 项目结构
```
backend/
📁 logs/
📁 scripts/
├── 📄 generate-ai-guide.js
└── 📄 test-simple.js
📁 src/
├── 📁 controllers/
│   ├── 📄 applicationController.js
│   ├── 📄 auditController.js
│   ├── 📄 exportController.js
│   ├── 📄 reviewController.js
│   ├── 📄 serviceController.js
│   └── 📄 volunteerController.js
├── 📁 middleware/
│   ├── 📄 authorizeReviewer.js
│   ├── 📄 errorHandler.js
│   ├── 📄 logger.js
│   ├── 📄 validateApplication.js
│   ├── 📄 validateExport.js
│   └── 📄 validateRequest.js
├── 📁 models/
│   ├── 📄 AuditLog.js
│   ├── 📄 NonProjectService.js
│   ├── 📄 ServiceApplication.js
│   └── 📄 Volunteer.js
├── 📁 routes/
│   ├── 📄 applicationRoutes.js
│   ├── 📄 auditRoutes.js
│   ├── 📄 exportRoutes.js
│   ├── 📄 reviewRoutes.js
│   ├── 📄 serviceRoutes.js
│   └── 📄 volunteerRoutes.js
├── 📁 services/
│   ├── 📄 AuditService.js
│   ├── 📄 ExportService.js
│   ├── 📄 ReviewService.js
│   └── 📄 ServiceService.js
├── 📁 utils/
│   ├── 📄 csvExporter.js
│   ├── 📄 database.js
│   ├── 📄 excelExporter.js
│   ├── 📄 IDGenerator.js
│   ├── 📄 idUtils.js
│   ├── 📄 queryUtils.js
│   ├── 📄 seedSimple.js
│   ├── 📄 transactionUtils.js
│   └── 📄 validationUtils.js
└── 📄 server.js
📄 AI-PROJECT-GUIDE.md
📄 Dockerfile
📄 Dockerfile.dev
📄 nodemon.json
📄 package-lock.json
⭐ package.json
📄 test.js

```

**说明**：
- 📁 目录
- 📄 普通文件
- 📋 routes/ 路由文件（完整显示）
- ⭐ 核心文件（完整显示）

---
## 完整文件内容

### package.json
**路径**: `package.json`
**说明**: 项目依赖和npm脚本配置

```json
{
  "name": "volunteer-tracker-backend",
  "version": "0.1.0",
  "description": "Backend API for Volunteer Tracker",
  "main": "src/server.js",
  "type": "module",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "docker:dev": "docker-compose up backend",
    "docker:build": "docker build -t volunteer-backend .",
    "docker:build-dev": "docker build -f Dockerfile.dev -t volunteer-backend-dev .",
    "seed": "node src/utils/seedSimple.js",
    "seed:docker": "docker-compose exec backend npm run seed",
    "test": "node scripts/test-simple.js",
    "test:docker": "docker-compose exec backend npm test",
    "reset": "npm run seed",
    "docs": "node scripts/generate-ai-guide.js ",
    "lint": "eslint src/**/*.js",
    "format": "prettier --write \"src/**/*.js\""
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.3.0",
    "express": "^4.18.2",
    "helmet": "^8.1.0",
    "mongoose": "^8.0.0",
    "morgan": "^1.10.1",
    "node-fetch": "^3.3.2",
    "csv-writer": "^1.6.0",
    "exceljs": "^4.4.0",
    "jszip": "^3.10.1",
    "express-validator": "^7.0.1"
  },
  "devDependencies": {
    "eslint": "^8.45.0",
    "nodemon": "^3.0.0",
    "prettier": "^3.0.0"
  }
}

```

### applicationRoutes.js
**路径**: `src/routes/applicationRoutes.js`
**说明**: API路由文件：application相关接口

```javascript
// src/routes/applicationRoutes.js
import express from 'express';
import ApplicationController from '../controllers/applicationController.js';
import { validateApplicationSubmission } from '../middleware/validateApplication.js';

const router = express.Router();

// 申请验证与提交
router.post('/validate', ApplicationController.validateApplication);
router.post('/', validateApplicationSubmission, ApplicationController.submitApplication);

// 申请查询
router.get('/my', ApplicationController.getMyApplications);

// 申请维护
router.delete('/:applicationId', ApplicationController.withdrawApplication);

export default router;
```

### auditRoutes.js
**路径**: `src/routes/auditRoutes.js`
**说明**: API路由文件：audit相关接口

```javascript
// src/routes/auditRoutes.js
import express from 'express';
import AuditController from '../controllers/auditController.js';

const router = express.Router();

// ========== 审计查询 ==========

// 获取审计日志列表
router.get('/logs', AuditController.getAuditLogs);

// 获取审计日志详情
router.get('/:auditId', AuditController.getAuditLogById);

// 获取目标审计历史
router.get('/target/:targetType/:targetId', AuditController.getTargetAuditHistory);

// ========== 审计分析 ==========

// 审计统计总览
router.get('/stats/summary', AuditController.getAuditStatistics);

// 操作人审计统计
router.get('/stats/operator/:operatorId', AuditController.getOperatorAuditStatistics);

// 审计时间线分析
router.get('/stats/timeline', AuditController.getAuditTimelineAnalysis);

// ========== 审计导出 ==========

// 导出审计日志
router.get('/export', AuditController.exportAuditLogs);

export default router;
```

### exportRoutes.js
**路径**: `src/routes/exportRoutes.js`
**说明**: API路由文件：export相关接口

```javascript
// src/routes/exportRoutes.js
import express from 'express';
import ExportController from '../controllers/exportController.js';
import { validateExportRequest } from '../middleware/validateExport.js';

const router = express.Router();

// 服务记录导出
router.get('/export', validateExportRequest, ExportController.exportServices);

// 流式导出（大数据量）
router.get('/export/stream', ExportController.streamExport);

// 统计导出
router.get('/export/stats', validateExportRequest, ExportController.exportStatistics);

// 下载导入模板
router.get('/export/template', ExportController.downloadTemplate);

export default router;

// 注意：这个路由应该挂载到 /api/v1/services 路径下
```

### reviewRoutes.js
**路径**: `src/routes/reviewRoutes.js`
**说明**: API路由文件：review相关接口

```javascript
// src/routes/reviewRoutes.js (更新版)
import express from 'express';
import ReviewController from '../controllers/reviewController.js';
import { authorizeReviewer } from '../middleware/authorizeReviewer.js';

const router = express.Router();

// 所有审核路由都需要验证审核权限
router.use(authorizeReviewer);

// ========== 审核查询 ==========
router.get('/pending', ReviewController.getPendingApplications);
router.get('/processed', ReviewController.getProcessedApplications);
router.get('/stats', ReviewController.getReviewStats);
router.get('/application/:applicationId', ReviewController.getApplicationForReview);

// ========== 审核操作 ==========
// 单个审核
router.post('/:applicationId', ReviewController.processApplicationReview);

// 按类型审核（保持向后兼容）
router.post('/create/:applicationId', ReviewController.processApplicationReview);
router.post('/update/:applicationId', ReviewController.processApplicationReview);
router.post('/delete/:applicationId', ReviewController.processApplicationReview);

// 批量审核
router.post('/batch', ReviewController.batchReviewApplications);

// 重审与撤回
router.post('/:reviewId/reopen', ReviewController.reopenReview);
router.delete('/:reviewId', ReviewController.withdrawReview);

export default router;
```

### serviceRoutes.js
**路径**: `src/routes/serviceRoutes.js`
**说明**: API路由文件：service相关接口

```javascript
// src/routes/serviceRoutes.js
import express from 'express';
import ServiceController from '../controllers/serviceController.js';
import ExportController from '../controllers/exportController.js'; // 新增
import { validateExportRequest } from '../middleware/validateExport.js'; // 新增

const router = express.Router();

// ========== 服务记录查询 ==========

// 获取服务记录列表
router.get('/', ServiceController.getServiceRecords);

// 获取服务记录详情
router.get('/:serviceId', ServiceController.getServiceRecordById);

// 获取志愿者的服务记录
router.get('/volunteer/:volunteerId', ServiceController.getServicesByVolunteer);

// 搜索服务记录
router.get('/search', ServiceController.searchServices);

// ========== 服务记录统计 ==========

// 服务记录总览统计
router.get('/stats/summary', ServiceController.getServiceStatistics);

// 志愿者服务统计
router.get('/stats/volunteer/:volunteerId', ServiceController.getVolunteerServiceStatistics);

// 地区服务统计
router.get('/stats/region/:region', ServiceController.getRegionServiceStatistics);

// 服务趋势统计
router.get('/stats/trend', ServiceController.getServiceTrendStatistics);

// ========== 服务记录导出 ==========

// 服务记录导出
router.get('/export', validateExportRequest, ExportController.exportServices);

// 流式导出（大数据量）
router.get('/export/stream', ExportController.streamExport);

// 统计导出
router.get('/export/stats', validateExportRequest, ExportController.exportStatistics);

// 下载导入模板
router.get('/export/template', ExportController.downloadTemplate);

export default router;
```

### volunteerRoutes.js
**路径**: `src/routes/volunteerRoutes.js`
**说明**: API路由文件：volunteer相关接口

```javascript
import express from 'express';
import {
  getAllVolunteers,
  getVolunteerById,
  createVolunteer,
  updateVolunteer,
  deleteVolunteer,
  getVolunteerStats
} from '../controllers/volunteerController.js';

const router = express.Router();

// 志愿者路由
router.route('/')
  .get(getAllVolunteers)    // 获取所有志愿者
  .post(createVolunteer);   // 创建志愿者

router.route('/stats')
  .get(getVolunteerStats);  // 获取统计信息

router.route('/:id')
  .get(getVolunteerById)    // 获取单个志愿者
  .put(updateVolunteer)     // 更新志愿者
  .delete(deleteVolunteer); // 删除志愿者

export default router;
```

### server.js
**路径**: `src/server.js`
**说明**: 主服务器文件，Express应用入口和配置

```javascript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';  // 导入 mongoose

import database from './utils/database.js';
import volunteerRoutes from './routes/volunteerRoutes.js';
import applicationRoutes from './routes/applicationRoutes.js'; // 新增
import reviewRoutes from './routes/reviewRoutes.js'; // 新增
import serviceRoutes from './routes/serviceRoutes.js'; // 新增
import auditRoutes from './routes/auditRoutes.js'; // 新增
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
app.use('/api/v1/applications', applicationRoutes); // 新增申请路由
app.use('/api/v1/reviews', reviewRoutes); // 新增审核路由
app.use('/api/v1/services', serviceRoutes); // 新增服务记录路由
app.use('/api/v1/audit', auditRoutes); // 新增审计日志路由

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
  console.log(`👤 志愿者API: http://localhost:${PORT}/api/v1/volunteers`);
  console.log(`📝 申请API: http://localhost:${PORT}/api/v1/applications`);
  console.log(`👮 审核API: http://localhost:${PORT}/api/v1/reviews`);
  console.log(`📊 服务记录API: http://localhost:${PORT}/api/v1/services`);
  console.log(`📜 审计日志API: http://localhost:${PORT}/api/v1/audit`);
  console.log(`📈 审计统计: http://localhost:${PORT}/api/v1/audit/stats/summary`);
  console.log(`💾 审计导出: http://localhost:${PORT}/api/v1/audit/export`);
});
```

*生成时间: 2026/1/15 19:14:37*
