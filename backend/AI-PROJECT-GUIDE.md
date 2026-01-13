# 🤖 后端项目AI协作指南

## 🎯 项目信息
- **项目类型**: Node.js + Express + MongoDB 后端API
- **主要功能**: 志愿者管理系统的数据层和API接口
- **技术栈**: Express.js, Mongoose, RESTful API

## 📋 文件分级说明
- **⭐ A级文件**: 核心文件（完整显示）
  - 应用入口（src/server.js）
  - 依赖配置（package.json）
  - 所有路由文件（src/routes/*.js）
- **📋 B级文件**: 重要源码（显示前50行）
  - 数据模型（src/models/*.js）
  - 控制器（src/controllers/*.js）
  - 工具函数（src/utils/*.js）
  - 中间件（src/middleware/*.js）
- **📄 C级文件**: 其他文件（仅索引）
  - 脚本、数据、配置等文件

## ❓ 如何协作
1. 先阅读本指南了解项目结构
2. 可以请求任何文件的完整内容
3. 修改代码前请先确认理解需求

---
## 🗂️ 项目结构

```
backend/
📁 logs/
📁 scripts/
├── 📄 generate-ai-guide.js
└── 📄 test-simple.js
📁 src/
├── 📁 controllers/
│   └── 📄 volunteerController.js
├── 📁 middleware/
│   ├── 📄 errorHandler.js
│   ├── 📄 logger.js
│   └── 📄 validateRequest.js
├── 📁 models/
│   └── 📄 Volunteer.js
├── 📁 routes/
│   └── 📄 volunteerRoutes.js
├── 📁 utils/
│   ├── 📄 database.js
│   └── 📄 seedSimple.js
└── 📄 server.js
📄 AI-PROJECT-GUIDE.md
📄 Dockerfile
📄 Dockerfile.dev
📄 nodemon.json
📄 package-lock.json
⭐ package.json

```

**图标说明**:
- ⭐ A级文件（完整显示）
- 📋 B级文件（显示前50行）
- 📄 C级文件（仅索引）

---
## ⭐ A级文件（完整内容）

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
    "node-fetch": "^3.3.2"
  },
  "devDependencies": {
    "eslint": "^8.45.0",
    "nodemon": "^3.0.0",
    "prettier": "^3.0.0"
  }
}

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
```

---
## 📋 B级文件（前50行预览）

### src/models/

#### Volunteer.js
**路径**: `src/models/Volunteer.js`
**说明**: 志愿者数据模型（Mongoose Schema）

**预览（前50行）**:

```javascript
import mongoose from 'mongoose';

const volunteerSchema = new mongoose.Schema({
  // 基本信息
  id: {
    type: String,
    required: [true, '志愿者ID是必需的'],
    unique: true,
    trim: true,
    match: [/^VM-\d{4}$/, 'ID格式必须是 VM-xxxx']
  },
  chineseName: {
    type: String,
    required: [true, '中文姓名是必需的'],
    trim: true,
    minlength: [2, '中文姓名至少2个字符'],
    maxlength: [50, '中文姓名最多50个字符']
  },
  englishName: {
    type: String,
    required: [true, '英文姓名是必需的'],
    trim: true,
    minlength: [2, '英文姓名至少2个字符'],
    maxlength: [100, '英文姓名最多100个字符']
  },
  avatar: {
    type: String,
    default: 'https://ui-avatars.com/api/?name=Unknown&background=random',
    trim: true
  },
  
  // 状态和地区
  status: {
    type: String,
    required: true,
    enum: {
      values: ['在职', '不在职'],
      message: '状态必须是"在职"或"不在职"'
    },
    default: '在职'
  },
  region: {
    type: String,
    required: [true, '地区是必需的'],
    trim: true,
    enum: ['中国大陆', '中国台湾', '东南亚', '美国', '欧洲', '其他']
  },
  
  // 服务信息
  services: {
...（还有 100 行）
```

### src/controllers/

#### volunteerController.js
**路径**: `src/controllers/volunteerController.js`
**说明**: 志愿者业务逻辑控制器（CRUD操作）

**预览（前50行）**:

```javascript
import Volunteer from '../models/Volunteer.js';

// 获取所有志愿者
export const getAllVolunteers = async (req, res) => {
  try {
    const {
      status,
      region,
      services,
      search,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      order = 'desc'
    } = req.query;

    // 构建查询条件
    let query = {};

    // 状态筛选
    if (status && ['在职', '不在职'].includes(status)) {
      query.status = status;
    }

    // 地区筛选
    if (region) {
      query.region = region;
    }

    // 服务方向筛选
    if (services) {
      const servicesArray = services.split(',');
      query.services = { $in: servicesArray };
    }

    // 搜索（姓名或ID）
    if (search) {
      query.$or = [
        { chineseName: { $regex: search, $options: 'i' } },
        { englishName: { $regex: search, $options: 'i' } },
        { id: { $regex: search, $options: 'i' } }
      ];
    }

    // 排序
    const sortOptions = {};
    sortOptions[sortBy] = order === 'desc' ? -1 : 1;

    // 分页
    const skip = (parseInt(page) - 1) * parseInt(limit);
...（还有 219 行）
```

### src/utils/

#### database.js
**路径**: `src/utils/database.js`
**说明**: MongoDB数据库连接配置

**预览（前50行）**:

```javascript
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

class Database {
  constructor() {
    this._connect();
  }

  _connect() {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/volunteer_demo';
    
    mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    })
    .then(() => {
      console.log('✅ MongoDB连接成功');
      console.log(`📊 数据库: ${mongoose.connection.db.databaseName}`);
    })
    .catch(err => {
      console.error('❌ MongoDB连接失败:', err.message);
      console.log('⚠️  请确保MongoDB服务正在运行');
      console.log('📌 启动MongoDB命令: mongod --dbpath=/path/to/data');
      process.exit(1);
    });

    // 连接事件监听
    mongoose.connection.on('connected', () => {
      console.log('📡 MongoDB已连接');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB连接错误:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB连接断开');
    });

    // 应用终止时关闭连接
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('👋 MongoDB连接已关闭');
      process.exit(0);
    });
  }
}

...（还有 1 行）
```

#### seedSimple.js
**路径**: `src/utils/seedSimple.js`
**说明**: 数据库种子数据生成器

**预览（前50行）**:

```javascript
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Volunteer from '../models/Volunteer.js';

dotenv.config();

const simpleVolunteers = [
  {
    id: "VM-0001",
    chineseName: "张三",
    englishName: "Zhang San",
    avatar: "https://i.pravatar.cc/150?img=1",
    status: "在职",
    region: "中国大陆",
    services: ["翻译", "管理"],
    nonProjectHours: 85,
    nonProjectCount: 32,
    email: "zhang.san@example.com",
    phone: "+86 13800138001"
  },
  {
    id: "VM-0002",
    chineseName: "李四",
    englishName: "Li Si",
    avatar: "https://i.pravatar.cc/150?img=2",
    status: "在职",
    region: "中国台湾",
    services: ["校对", "技术"],
    nonProjectHours: 120,
    nonProjectCount: 45,
    email: "li.si@example.com",
    phone: "+886 912345678"
  },
  {
    id: "VM-0003",
    chineseName: "王五",
    englishName: "Wang Wu",
    avatar: "https://i.pravatar.cc/150?img=3",
    status: "不在职",
    region: "东南亚",
    services: ["社区服务"],
    nonProjectHours: 65,
    nonProjectCount: 25,
    email: "wang.wu@example.com",
    phone: "+65 81234567"
  },
  {
    id: "VM-0004",
    chineseName: "赵六",
    englishName: "Zhao Liu",
...（还有 69 行）
```

### src/middleware/

#### errorHandler.js
**路径**: `src/middleware/errorHandler.js`
**说明**: 全局错误处理中间件

**预览（前35行）**:

```javascript
// 404中间件
export const notFound = (req, res, next) => {
  const error = new Error(`未找到路由 - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

// 全局错误处理中间件
export const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;

  // Mongoose错误处理
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

  res.status(statusCode).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    timestamp: new Date().toISOString()
  });
};
```

#### logger.js
**路径**: `src/middleware/logger.js`
**说明**: 中间件

**预览（前20行）**:

```javascript
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

```

#### validateRequest.js
**路径**: `src/middleware/validateRequest.js`
**说明**: 中间件

**预览（前25行）**:

```javascript
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

```

---
## 📑 文件索引

### 配置文件

- 📄 `Dockerfile`
- 📄 `Dockerfile.dev`
- 📄 `nodemon.json`
- 📄 `package-lock.json`
- ⭐ `package.json`

### 路由文件

- 📄 `src\routes\volunteerRoutes.js`

### 数据模型

- 📄 `src\models\Volunteer.js`

### 控制器

- 📄 `src\controllers\volunteerController.js`

### 中间件

- 📄 `src\middleware\errorHandler.js`
- 📄 `src\middleware\logger.js`
- 📄 `src\middleware\validateRequest.js`

### 工具文件

- 📄 `src\utils\database.js`
- 📄 `src\utils\seedSimple.js`

### 脚本文件

- 📄 `scripts\generate-ai-guide.js`
- 📄 `scripts\test-simple.js`

### 文档文件

- 📄 `AI-PROJECT-GUIDE.md`

### 其他文件

- 📄 `src\server.js`

---
*生成时间: 2026/1/12 19:00:16*
