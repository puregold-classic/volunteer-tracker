# 🚀 第一阶段：项目初始化与环境搭建

## 📁 第一步：清理和准备demo分支

### 1.1 创建临时分支备份（安全起见）

```bash
# 确保在主分支
git checkout main
git pull origin main

# 创建备份分支（如果需要保留现有内容）
git checkout -b demo-backup

# 回到demo分支
git checkout demo

# 查看当前分支内容
ls -la
```

### 1.2 清理demo分支（如果确认要删除所有内容）

```bash
# 保留git历史，只删除所有文件（推荐）
git rm -rf .
git clean -fd
```

## 🏗️ 第二步：创建项目结构

### 2.1 创建基础目录结构

```bash
# 创建根目录结构
mkdir -p frontend/src/components/VolunteerCard
mkdir -p frontend/src/services
mkdir -p frontend/src/utils
mkdir -p frontend/public

mkdir -p backend/src/models
mkdir -p backend/src/routes
mkdir -p backend/src/middleware
mkdir -p backend/src/utils

mkdir -p data
mkdir -p scripts
mkdir -p docs

# 创建关键文件
touch frontend/src/App.jsx
touch frontend/src/main.jsx
touch frontend/index.html
touch frontend/package.json
touch frontend/vite.config.js

touch backend/src/server.js
touch backend/package.json
touch backend/.env.example

touch data/volunteers.json
touch docker-compose.yml
touch .gitignore
touch README.md

# 创建组件文件
touch frontend/src/components/VolunteerCard/VolunteerCard.jsx
touch frontend/src/components/VolunteerCard/VolunteerCard.scss
touch frontend/src/components/VolunteerCard/index.js

# 创建服务文件
touch frontend/src/services/api.js
touch frontend/src/services/volunteerService.js

# 创建后端文件
touch backend/src/models/Volunteer.js
touch backend/src/routes/volunteerRoutes.js
touch backend/src/middleware/errorHandler.js
```

### 2.2 初始化git仓库（如果完全重置）

```bash

# 初始化git（如果没有）
git init

# 添加所有文件
git add .

# 提交初始结构
git commit -m "chore: initialize demo branch structure"
```

## 📦 第三步：配置基础环境文件

### 3.1 创建 .gitignore 文件

```gitignore
# 依赖目录
node_modules/
dist/
build/

# 环境变量
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# 日志
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# 运行时数据
*.pid
*.seed
*.pid.lock

# 数据库相关
*.db
*.sqlite
*.sqlite3
data/db/

# 覆盖率
coverage/
.nyc_output/

# 编辑器
.vscode/
.idea/
*.swp
*.swo
*~

# 系统
.DS_Store
Thumbs.db

# Docker
docker-data/
```

### 3.2 创建 package.json 文件模板

**前端 package.json:**

```json
{
  "name": "volunteer-tracker-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0",
    "format": "prettier --write \"src/**/*.{js,jsx,css,scss}\""
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.0",
    "eslint": "^8.45.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.4.0",
    "postcss": "^8.4.0",
    "prettier": "^3.0.0",
    "sass": "^1.69.0",
    "typescript": "^5.0.0",
    "vite": "^5.0.0"
  }
}
```

**后端 package.json:**

```json
{
  "name": "volunteer-tracker-backend",
  "version": "0.1.0",
  "description": "Backend API for Volunteer Tracker",
  "main": "src/server.js",
  "type": "module",  
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon --experimental-modules src/server.js",
    "seed": "node src/utils/seedDatabase.js",
    "lint": "eslint src/**/*.js",
    "format": "prettier --write \"src/**/*.js\""
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.3.0",
    "express": "^4.18.2",
    "mongoose": "^8.0.0"
  },
  "devDependencies": {
    "eslint": "^8.45.0",
    "nodemon": "^3.0.0",
    "prettier": "^3.0.0"
  }
}
```

### 3.3 创建环境变量示例文件

**backend/.env.example:**

```env
# 服务器配置
PORT=5000
NODE_ENV=development

# 数据库配置
MONGODB_URI=mongodb://localhost:27017/volunteer_demo

# CORS配置
CORS_ORIGIN=http://localhost:3000

# API版本
API_VERSION=v1
```

**frontend/.env.example:**

```env
# API基础URL
VITE_API_BASE_URL=http://localhost:5000/api

# 应用配置
VITE_APP_NAME=Volunteer Tracker Demo
VITE_APP_VERSION=0.1.0
```

### 创建.env文件

**backend/.env:**

```bash
# cd到backend，复制对应的.env.example为.env
cp .env.example .env
```

**frontend/.env:**

```bash
# cd到frontend，同样复制对应的.env.example为.env
cp .env.example .env
```

## ⚙️ 第四步：配置开发工具

### 4.1 前端配置（vite.config.js）

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      }
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@import "./src/styles/variables.scss";`
      }
    }
  }
})
```

### 4.2 TypeScript配置（如果需要）

**frontend/tsconfig.json:**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

**frontend/tsconfig.node.json:**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "types": ["node"]
  },
  "include": ["vite.config.ts", "package.json"]
}
```

### 4.3 ESLint配置

```javascript
// frontend/.eslintrc.cjs
module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.2' } },
  rules: {
    'react/jsx-no-target-blank': 'off',
    'react/prop-types': 'off',
  },
}
```

### 4.4 后端创建nodemon配置文件（可选）

**backend/nodemon.json:**

```json
{
  "watch": ["src"],
  "ext": "js,json",
  "ignore": ["src/**/*.spec.js", "node_modules"],
  "exec": "node --experimental-modules src/server.js"
}
```

## 🧪 第五步：验证环境配置

### 5.1 安装依赖

```bash
# 前端
cd frontend
npm install

# 后端
cd ../backend
npm install
```

### 5.2 创建最小验证文件

**frontend/src/main.jsx:**

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

**frontend/src/App.jsx:**

```jsx
function App() {
  return (
    <div>
      <h1>Volunteer Tracker Demo</h1>
      <p>Environment setup successful!</p>
    </div>
  )
}

export default App
```

**frontend/index.html:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Volunteer Tracker Demo</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

**backend/src/server.js:**

```javascript
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
```

### 5.3 测试环境

```bash
# 启动后端（在backend目录）
npm run dev

# 启动前端（在frontend目录，新终端）
npm run dev

# 测试后端
curl http://localhost:5000/health

# 访问前端
# 打开浏览器访问 http://localhost:3000
```

## ✅ 第一阶段完成检查清单

- [ ] demo分支清理完成
- [ ] 项目结构创建完成
- [ ] 所有配置文件就位
- [ ] 基础依赖安装完成
- [ ] 前后端都能成功启动
- [ ] 环境变量配置正确
- [ ] Git已提交初始结构

## 📝 提交到GitHub

```bash
# 添加所有文件
git add .

# 提交第一阶段完成
git commit -m "feat: complete phase 1 - project initialization and environment setup"

# 推送到远程demo分支
git push origin demo --force  # 如果之前有内容需要强制推送
```

## AI对话链接

```text
https://chat.deepseek.com/share/utonv90brjlpiwp656
```
