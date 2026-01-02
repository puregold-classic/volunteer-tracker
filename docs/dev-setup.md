# 开发环境设置指南

## 🚀 快速开始

### 环境要求
- Node.js 18.x 或更高版本
- npm 8.x 或更高版本
- Git

### 安装步骤

1. **克隆项目**
```
git clone https://github.com/your-username/volunteer-tracker.git
cd volunteer-tracker
```
2. **安装前端依赖**
```
cd frontend
npm install
```
3. **启动开发服务器**
```
npm run dev
```
4. **在浏览器中打开**
```
http://localhost:5173
```
### 开发脚本

```bash
# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview

# 代码检查
npm run lint

# 自动修复代码风格
npm run lint:fix

# 运行测试
npm run test

# 运行测试（带UI）
npm run test:ui

# 生成测试覆盖率报告
npm run test:coverage
```

## ⚙️ 环境配置

### 环境变量

创建 .env 文件：

```env
VITE_API_URL=http://localhost:3000/api
VITE_MAPBOX_TOKEN=your_mapbox_token
VITE_APP_TITLE="Volunteer Tracker
```
### 开发工具

推荐安装以下 VS Code 扩展：

- ESLint

- Prettier

- GitLens

- SCSS IntelliSense

- React/TypeScript 相关扩展

## 📁 项目结构

```
frontend/src/
├── components/     # 可复用组件
├── pages/         # 页面组件
├── services/      # API 服务层
├── utils/         # 工具函数
├── assets/        # 静态资源
└── App.jsx        # 根组件
```

## 🔧 代码规范

### 命名约定

- 组件：PascalCase (UserProfile.jsx)

- 工具函数：camelCase (formatDate.js)

- 样式文件：kebab-case (user-profile.scss)

- 常量：UPPER_SNAKE_CASE (API_ENDPOINTS)

### 提交规范

使用 Conventional Commits：

- feat: 新功能

- fix: 修复 bug

- docs: 文档更新

- style: 代码格式

- refactor: 重构

- test: 测试相关

