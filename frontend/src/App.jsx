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
