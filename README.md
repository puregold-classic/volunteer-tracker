# Volunteer Tracker - Demo 分支

这是一个志愿者管理系统的演示版本，专注于志愿者卡片的展示和管理。

## 🌟 功能特性

### 当前版本功能

- 志愿者卡片展示：美观的卡片式布局展示志愿者信息

- 基础信息展示：

  - 志愿者头像

  - 中英文姓名

  - 唯一ID (VM-xxxx格式)

  - 服务方向标签

  - 非项目服务统计

  - 在职状态指示

- 响应式设计：适配桌面和移动设备

- 实时数据：从后端API获取最新志愿者数据

### 卡片设计示例

```text
┌─────────────────────────────────┐
│  [小头像] 王明 (Wang Ming)       │
│  ID: VM-0456                    │
│  ▶ 服务方向：翻译、管理          │
│  ▶ 非项目服务：85小时 (32次)     │
│  ▶ 状态：● 在职 | ○ 不在职       │
└─────────────────────────────────┘
```

## 🏗️ 项目结构

```text
volunteer-tracker-demo/
├── frontend/                 # React前端应用
│   ├── src/
│   │   ├── components/
│   │   │   └── VolunteerCard/  # 志愿者卡片组件
│   │   ├── services/          # API服务
│   │   └── App.jsx           # 主应用组件
│   └── package.json
├── backend/                  # Node.js后端服务
│   ├── src/
│   │   ├── models/          # 数据模型
│   │   ├── routes/          # API路由
│   │   └── server.js        # 服务器入口
│   └── package.json
├── data/                     # 初始数据
│   └── volunteers.json      # 志愿者种子数据
├── docker-compose.yml       # Docker编排配置
└── README.md               # 本文档
```

## 🚀 快速开始

## 前提条件

- Node.js 18+

- MongoDB 8.3+

- Docker & Docker Compose (可选)

### 方法一：使用 Docker（推荐）

#### 克隆仓库并切换到demo分支

```bash
git clone <https://github.com/your-username/volunteer-tracker.git>
cd volunteer-tracker
git checkout demo
```

#### 一键启动所有服务

```bash
docker-compose up -d
```

#### 访问应用

##### 前端应用：<http://localhost:3000>

##### 后端API：<http://localhost:5000/api/volunteers>

##### MongoDB: localhost:27017

### 方法二：手动启动

#### 后端服务

```bash
cd backend
npm install
npm run dev
```

#### 前端应用

```bash
cd frontend
npm install
npm run dev
```

#### 数据库

确保MongoDB服务运行：

```bash
mongod --dbpath=/path/to/data
```

## 📡 API接口

### 获取所有志愿者

```http
GET <http://localhost:5000/api/volunteers>
```

### 获取单个志愿者

```http
GET <http://localhost:5000/api/volunteers/:id>
```

### 响应格式

```json
{
  "success": true,
  "data": [
    {
      "id": "VM-0456",
      "chineseName": "王明",
      "englishName": "Wang Ming",
      "avatar": "avatar_url",
      "services": ["翻译", "管理"],
      "nonProjectHours": 85,
      "nonProjectCount": 32,
      "status": "在职",
      "region": "中国大陆"
    }
  ]
}
```

## 📊 初始数据

系统预置了10条志愿者数据，包含：

- 不同地区分布（中国大陆、台湾、东南亚、美国、欧洲）

- 多种服务方向（翻译、校对、管理、技术、其他）

- 混合的在职状态

- 随机的服务时长和次数

## 🧪 测试数据

系统启动时会自动创建以下测试数据：

- 志愿者数量：20条记录

- 状态分布：70%在职，30%不在职

- 地区分布：均匀分布到各个预设地区

- 服务方向：每个志愿者1-3个服务方向

- 服务时长：10-200小时随机

## 📁 数据模型

```javascript
{
  id: String,          // 格式: "VM-xxxx"
  chineseName: String,  // 中文姓名
  englishName: String,  // 英文姓名
  avatar: String,      // 头像URL
  status: String,      // "在职" 或 "不在职"
  region: String,      // 所属地区
  services: [String],  // 服务方向数组
  nonProjectHours: Number,  // 非项目服务时长
  nonProjectCount: Number,  // 非项目服务次数
  createdAt: Date,
  updatedAt: Date
}
```

## 🔧 技术栈

### 前端

- React 18 - UI框架

- Vite - 构建工具

- TypeScript - 类型安全

- SCSS - 样式预处理

- Axios - HTTP客户端

### 后端

- Node.js - 运行环境

- Express - Web框架

- MongoDB + Mongoose - 数据库

- CORS - 跨域支持

### 开发工具

- ESLint - 代码检查

- Prettier - 代码格式化

- Nodemon - 开发热重载

## 🎨 自定义配置

### 环境变量

创建 .env 文件：

```bash
# 后端
MONGODB_URI=mongodb://localhost:27017/volunteer_demo
PORT=5000

# 前端
VITE_API_BASE_URL=<http://localhost:5000/api>
```

### 修改志愿者数据

编辑 data/volunteers.json 文件来调整初始数据。

## 🔄 开发脚本

```bash
# 后端
npm run dev      # 开发模式
npm start        # 生产模式
npm run seed     # 重置数据库数据
# 前端
npm run dev      # 开发服务器
npm build        # 构建生产版本
npm preview      # 预览构建结果
```

## 📱 响应式设计

- 桌面端：网格布局，每行显示3-4张卡片

- 平板端：每行显示2-3张卡片

- 移动端：每行显示1张卡片，垂直滚动
