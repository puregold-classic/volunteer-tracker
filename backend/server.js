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
