#!/bin/bash

echo "🚀 启动志愿者管理系统后端（MongoDB 版本）"
echo "======================================"

# 检查 MongoDB
if ! netstat -ano 2>/dev/null | grep -q ":27017 "; then
    echo "⚠️  MongoDB 未运行，请先启动 MongoDB"
    echo "运行: ./start-mongodb.sh"
    exit 1
fi

echo "✅ MongoDB 正在运行"

# 进入后端目录
cd backend

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
fi

# 设置环境
export NODE_ENV=development

echo ""
echo "🌐 启动后端服务器..."
echo "   地址: http://localhost:3000"
echo "   API:  http://localhost:3000/api/v1"
echo "   健康检查: http://localhost:3000/health"
echo ""
echo "📊 数据库状态:"
echo "   连接: mongodb://localhost:27017/volunteer_tracker"
echo ""
echo "按 Ctrl+C 停止服务器"
echo ""

# 启动服务器
npm run dev
