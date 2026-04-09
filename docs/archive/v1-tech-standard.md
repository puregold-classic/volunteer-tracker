# 🗺️ 志愿者管理系统 - 架构与构建蓝图
## 📋 项目概述
### 核心愿景
构建一个全球志愿者可视化管理系统，通过交互式世界地图展示志愿者分布，支持多维筛选和详情管理。

### 技术栈选型
- 前端：React + Vite + TypeScript + SCSS
- 地图可视化：Leaflet + React-Leaflet
- UI组件：自定义组件库，无第三方UI框架
- 后端：Node.js + Express + MongoDB
- 数据格式：JSON + GeoJSON
- 部署：Docker容器化

## 🏗️ 系统架构
### 模块化设计
```
volunteer-tracker/
├── frontend/          # 独立前端应用
├── backend/           # RESTful API服务
├── shared/            # 前后端共享资源
├── scripts/           # 开发运维脚本
└── docs/              # 项目文档
```

### 数据流设计
（注：原文未提供具体数据流内容，此处保留标题占位）

## 🗂️ 仓库结构规范
### 1. 前端项目结构 (frontend/)
```
frontend/
📄 .eslintrc.cjs
🌐 index.html
📋 package-lock.json
📋 package.json
📁 public/
📁 scripts/
└── 📜 analyze-project.js
📁 src/
├── 🎨💎 App.scss
├── ⚛️📘 App.tsx
├── 📁 components/
│   ├── 📁 Footer/
│   │   ├── 🎨💎 Footer.scss
│   │   ├── ⚛️📘 Footer.tsx
│   │   └── 📘 index.ts
│   ├── 📁 Header/
│   │   ├── 🎨💎 Header.scss
│   │   ├── ⚛️📘 Header.tsx
│   │   └── 📘 index.ts
│   ├── 📘 index.ts
│   ├── 📁 LoadingSpinner/
│   │   ├── 📘 index.ts
│   │   ├── 🎨💎 LoadingSpinner.scss
│   │   └── ⚛️📘 LoadingSpinner.tsx
│   ├── 📁 VolunteerCard/
│   │   ├── 📘 index.ts
│   │   ├── 🎨💎 VolunteerCard.scss
│   │   └── ⚛️📘 VolunteerCard.tsx
│   └── 📁 VolunteerList/
│       ├── 📘 index.ts
│       ├── 🎨💎 VolunteerList.scss
│       └── ⚛️📘 VolunteerList.tsx
├── 📘 env.d.ts
├── ⚛️📘 main.tsx
├── 📁 services/
│   ├── 📘 api.ts
│   ├── 📘 types.ts
│   └── 📘 volunteerService.ts
├── 📁 styles/
│   ├── 🎨💎 animations.scss
│   ├── 🎨💎 global.scss
│   ├── 🎨💎 mixins.scss
│   └── 🎨💎 variables.scss
└── 📁 utils/
📋 tsconfig.json
📋 tsconfig.node.json
📘 vite.config.ts
```

### 2. 后端项目结构 (backend/)
```
backend/
🐳 Dockerfile
🐳 Dockerfile.dev
📁 logs/
📋 nodemon.json
📋 package-lock.json
📋 package.json
📁 scripts/
├── 📜 analyze-project.js
└── 📜 test-simple.js
📁 src/
├── 📁 controllers/
│   └── 📜 volunteerController.js
├── 📁 middleware/
│   └── 📜 errorHandler.js
├── 📁 models/
│   └── 📜 Volunteer.js
├── 📁 routes/
│   └── 📜 volunteerRoutes.js
├── 📜 server.js
└── 📁 utils/
    ├── 📜 database.js
    └── 📜 seedSimple.js
```

### 3. 共享资源 (shared/)
```
shared/
├── data-schemas/     # 数据模式定义
│   ├── volunteer.schema.json
│   └── region.schema.json
├── geo-data/         # 地理边界数据
│   ├── world-countries.json
│   ├── china-provinces.json
│   └── simplified/   # 简化版（性能优化）
└── seed-data/        # 初始数据
    └── volunteers/
```