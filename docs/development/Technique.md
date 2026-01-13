🗺️ 志愿者管理系统 - 架构与构建蓝图
📋 项目概述
核心愿景
构建一个全球志愿者可视化管理系统，通过交互式世界地图展示志愿者分布，支持多维筛选和详情管理。

技术栈选型
前端：React + Vite + TypeScript + SCSS

地图可视化：Leaflet + React-Leaflet

UI组件：自定义组件库，无第三方UI框架

后端：Node.js + Express + MongoDB

数据格式：JSON + GeoJSON

部署：Docker容器化

🏗️ 系统架构
模块化设计
text
volunteer-tracker/
├── frontend/          # 独立前端应用
├── backend/           # RESTful API服务
├── shared/            # 前后端共享资源
├── scripts/           # 开发运维脚本
└── docs/              # 项目文档
数据流设计

🗂️ 仓库结构规范

1. 前端项目结构 (frontend/)
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
│   │   ├── 📘 index.ts
│   │   ├── 🎨💎 VolunteerList.scss
│   │   └── ⚛️📘 VolunteerList.tsx
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
1. 后端项目结构 (backend/)
text
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
│   ├── 📜 database.js
│   └── 📜 seedSimple.js

1. 共享资源 (shared/)
text
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

🎯 核心功能模块
4. 地图可视化模块
基础功能：完整世界地图，国家/省份边界显示

交互设计：

点击地区 → 显示该区域志愿者面板

鼠标悬停 → 显示地区名称和志愿者数量

快速聚焦栏：一键定位到预设区域

技术实现：

Leaflet 基础地图

GeoJSON 数据渲染

自定义区域样式和交互事件

1. 志愿者数据管理
数据模型：

javascript
// 志愿者数据结构示例
{
  id: "VM-0001",              // 唯一标识
  chineseName: "张三",        // 中文姓名
  englishName: "Zhang San",   // 英文姓名
  status: "active",           // 状态：active/inactive/pending
  region: "mainland-china",   // 所属地区
  services: ["translation"],  // 服务方向
  totalHours: 120.5,          // 总服务时长
  // ... 其他字段
}
CRUD操作：完整的增删改查接口

筛选系统：按状态、地区、服务方向多维度筛选

1. 统计展示模块
实时统计：总人数、在职/非在职人数、总服务时长

可视化图表：地区分布、服务类型占比、月度趋势

1. 响应式布局设计
桌面端：上中下三栏布局（统计头、地图、控制面板）

移动端：地图全屏，点击弹出面板

自适应断点：基于屏幕宽度动态调整组件布局
