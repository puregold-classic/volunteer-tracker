#!/bin/bash
# 开发环境启动脚本

set -e  # 遇到错误时退出

echo "🚀 启动志愿者管理系统开发环境..."

# 检查必要工具
command -v docker >/dev/null 2>&1 || { echo "❌ 需要安装Docker"; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "❌ 需要安装Docker Compose"; exit 1; }

# 创建环境文件（如果不存在）
if [ ! -f .env ]; then
    echo "📝 创建 .env 文件..."
    cp .env.development.example .env.development
    echo "⚠️  请检查 .env.development 文件配置"
fi

# 创建docker-compose覆盖文件（如果不存在）
if [ ! -f docker-compose.override.yml ]; then
    echo "📝 创建 docker-compose.override.yml..."
    cp docker-compose.override.yml.example docker-compose.override.yml
    echo "⚠️  请检查 docker-compose.override.yml 配置"
fi

# 检查前端依赖
if [ ! -d "frontend/node_modules" ]; then
    echo "📦 安装前端依赖..."
    cd frontend && npm install && cd ..
fi

# 检查后端依赖（容器外，用于开发）
if [ ! -d "backend/node_modules" ]; then
    echo "📦 安装后端依赖..."
    cd backend && npm install && cd ..
fi

# 启动Docker服务
echo "🐳 启动容器服务..."
docker-compose up -d mongodb backend

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 5

# 检查服务状态
echo "🔍 检查服务状态..."
if docker-compose ps | grep -q "Up"; then
    echo "✅ 容器服务启动成功"
else
    echo "❌ 容器服务启动失败"
    docker-compose logs --tail=20
    exit 1
fi

# 启动前端开发服务器（在后台）
echo "💻 启动前端开发服务器..."
cd frontend && npm run dev &
FRONTEND_PID=$!

# 设置退出时清理
cleanup() {
    echo "🧹 清理资源..."
    kill $FRONTEND_PID 2>/dev/null
    docker-compose down
}
trap cleanup EXIT

echo ""
echo "=========================================="
echo "🌐 服务访问地址:"
echo "  前端应用: http://localhost:3000"
echo "  后端API:  http://localhost:5000"
echo "  健康检查: http://localhost:5000/api/health"
echo "  数据库管理: http://localhost:8081 (如果启用)"
echo ""
echo "📋 可用命令:"
echo "  make logs      - 查看日志"
echo "  make stop      - 停止服务"
echo "  make restart   - 重启服务"
echo "  make seed      - 初始化数据库"
echo "=========================================="
echo ""
echo "📝 按 Ctrl+C 停止所有服务"

# 保持脚本运行，等待信号
wait $FRONTEND_PID