# 1. 创建项目结构
mkdir -p frontend backend

# 2. 创建后端最小文件
cat > backend/package.json << 'EOF'
{
  "name": "backend",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5"
  }
}
EOF

cat > backend/server.js << 'EOF'
// 最小后端服务器
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// 基础API
app.get('/', (req, res) => {
  res.json({ 
    message: 'DEMO分支后端服务',
    version: '1.0.0',
    status: 'running'
  });
});

app.get('/api/demo', (req, res) => {
  res.json({
    success: true,
    message: '来自DEMO分支的数据',
    data: {
      users: [
        { id: 1, name: 'Demo用户1', role: '志愿者' },
        { id: 2, name: 'Demo用户2', role: '管理员' }
      ],
      stats: {
        total: 2,
        active: 1
      }
    }
  });
});

const PORT = 3001; // 使用不同端口避免冲突
app.listen(PORT, () => {
  console.log(`🚀 DEMO后端启动: http://localhost:${PORT}`);
});
EOF

# 3. 创建前端最小文件
mkdir -p frontend/src

cat > frontend/package.json << 'EOF'
{
  "name": "frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.0.3",
    "vite": "^4.4.5"
  }
}
EOF

cat > frontend/vite.config.js << 'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174, // 使用不同端口
    open: true
  }
})
EOF

cat > frontend/index.html << 'EOF'
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DEMO - 最小志愿者系统</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
EOF

cat > frontend/src/main.jsx << 'EOF'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
EOF

cat > frontend/src/index.css << 'EOF'
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
}
EOF

cat > frontend/src/App.jsx << 'EOF'
import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [backendData, setBackendData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 模拟API调用
    setTimeout(() => {
      setBackendData({
        message: "DEMO分支前端应用",
        apiEndpoint: "http://localhost:3001/api/demo",
        features: [
          "完全独立的分支",
          "最小可运行版本",
          "无复杂依赖",
          "纯演示用途"
        ]
      })
      setLoading(false)
    }, 1000)
  }, [])

  return (
    <div className="app">
      <div className="demo-banner">
        <h1>🎯 DEMO分支</h1>
        <p>最小可运行版本 - 从零开始创建</p>
      </div>

      <div className="content">
        <div className="card">
          <h2>✨ 特性</h2>
          <ul>
            <li>✅ 完全干净的代码库</li>
            <li>✅ 无历史包袱</li>
            <li>✅ 仅必要的最小文件</li>
            <li>✅ 适合学习和演示</li>
          </ul>
        </div>

        <div className="card">
          <h2>📊 后端状态</h2>
          <div className="status">
            <div className="status-item">
              <span className="status-dot active"></span>
              <span>API服务: 运行在端口 3001</span>
            </div>
            <div className="status-item">
              <span className="status-dot active"></span>
              <span>前端服务: 运行在端口 5174</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h2>🚀 如何运行</h2>
          <div className="code-block">
            <pre>{`# 启动后端
cd backend
npm install
npm start

# 启动前端 (新终端)
cd frontend
npm install
npm run dev`}</pre>
          </div>
        </div>

        <div className="card">
          <h2>📁 文件结构</h2>
          <div className="file-tree">
            <pre>{`volunteer-demo-clean/
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── backend/
│   ├── server.js
│   └── package.json
└── .git/`}</pre>
          </div>
        </div>
      </div>

      <footer className="footer">
        <p>这是一个完全独立的最小可运行版本，与原始develop分支完全分离。</p>
      </footer>
    </div>
  )
}

export default App
EOF

cat > frontend/src/App.css << 'EOF'
.app {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  min-height: 100vh;
  color: #333;
}

.demo-banner {
  text-align: center;
  background: rgba(255, 255, 255, 0.95);
  padding: 40px;
  border-radius: 20px;
  margin-bottom: 30px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.1);
}

.demo-banner h1 {
  font-size: 3rem;
  color: #2c3e50;
  margin-bottom: 10px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.demo-banner p {
  font-size: 1.2rem;
  color: #7f8c8d;
}

.content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 40px;
}

.card {
  background: white;
  padding: 25px;
  border-radius: 15px;
  box-shadow: 0 5px 15px rgba(0,0,0,0.08);
  transition: transform 0.3s ease;
}

.card:hover {
  transform: translateY(-5px);
}

.card h2 {
  color: #2c3e50;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 2px solid #f0f0f0;
}

.card ul {
  list-style: none;
  padding: 0;
}

.card li {
  padding: 10px 0;
  border-bottom: 1px solid #eee;
  position: relative;
  padding-left: 30px;
}

.card li:before {
  content: "✓";
  color: #27ae60;
  position: absolute;
  left: 0;
  font-weight: bold;
  font-size: 1.2em;
}

.status {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 8px;
}

.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-block;
}

.status-dot.active {
  background: #2ecc71;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

.code-block, .file-tree {
  background: #2c3e50;
  color: #ecf0f1;
  padding: 15px;
  border-radius: 8px;
  overflow-x: auto;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
}

.code-block pre, .file-tree pre {
  margin: 0;
  white-space: pre-wrap;
}

.footer {
  text-align: center;
  padding: 30px;
  background: white;
  border-radius: 15px;
  color: #7f8c8d;
  font-size: 0.95rem;
}
EOF

# 4. 创建根目录文件
cat > .gitignore << 'EOF'
# 依赖
node_modules/

# 环境
.env
.env.local

# 编辑器
.vscode/
.idea/
*.swp
*.swo

# 系统
.DS_Store
Thumbs.db

# 日志
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# 构建输出
dist/
build/
*.tmp
EOF

cat > README.md << 'EOF'
# 🎯 DEMO分支 - 最小可运行版本

这是一个从零开始创建的完全独立的最小版本，专门用于演示和学习。

## ✨ 特性

- ✅ 完全干净的代码库（无历史包袱）
- ✅ 最小文件结构
- ✅ 独立运行端口（避免冲突）
- ✅ 清晰的架构展示

## 🚀 快速开始

### 后端启动
```bash
cd backend
npm install
npm start
# 访问: http://localhost:3001

EOF
