# 🚀 混合容器化方案 - 详细实施指南

## 📋 **实施目标**
创建既保持开发体验，又确保环境一致性的混合容器化架构。

## 🏗️ **第一阶段：基础架构搭建**

### **1.1 创建项目根目录结构**

```bash
# 在项目根目录（volunteer-tracker/）创建以下结构
mkdir -p scripts/dev scripts/deploy
mkdir -p config docs/{development,deployment}

# 创建关键文件
touch docker-compose.yml docker-compose.override.yml.example
touch .env.development.example .env.production.example
touch Makefile  # 可选，提供跨平台命令
```

### **1.2 创建环境配置文件**

**.env.development.example:**
```env
# 开发环境配置
NODE_ENV=development

# MongoDB 配置
MONGODB_URI=mongodb://mongodb:27017/volunteer_tracker
MONGODB_DATABASE=volunteer_tracker

# 后端服务配置
BACKEND_PORT=5000
BACKEND_HOST=0.0.0.0
CORS_ORIGIN=http://localhost:3000

# 前端服务配置
FRONTEND_PORT=3000
VITE_API_BASE_URL=http://localhost:5000/api
```

**.env.production.example:**
```env
# 生产环境配置示例
NODE_ENV=production

# MongoDB 配置（生产环境使用云服务或独立实例）
MONGODB_URI=mongodb://username:password@mongodb-host:27017/volunteer_tracker_prod?authSource=admin

# 后端服务配置
BACKEND_PORT=5000
BACKEND_HOST=0.0.0.0
CORS_ORIGIN=https://your-domain.com

# 安全配置
JWT_SECRET=your-production-jwt-secret-change-this
API_RATE_LIMIT=100
```

### **1.3 创建主 docker-compose.yml**

**docker-compose.yml:**
```yaml
version: '3.8'

# 定义网络，确保服务间通信
networks:
  volunteer-network:
    driver: bridge

# 定义卷，用于数据持久化
volumes:
  mongo-data:
    driver: local
  mongo-config:
    driver: local

# 定义所有服务
services:
  # MongoDB 数据库服务
  mongodb:
    image: mongo:7-jammy
    container_name: volunteer-mongodb
    restart: unless-stopped
    networks:
      - volunteer-network
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_DATABASE: volunteer_tracker
    volumes:
      - mongo-data:/data/db
      - mongo-config:/data/configdb
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # 后端 API 服务
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev  # 开发用Dockerfile
    container_name: volunteer-backend
    restart: unless-stopped
    networks:
      - volunteer-network
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=development
      - MONGODB_URI=mongodb://mongodb:27017/volunteer_tracker
      - CORS_ORIGIN=http://localhost:3000
    depends_on:
      mongodb:
        condition: service_healthy
    volumes:
      - ./backend:/app  # 代码挂载，支持热重载
      - /app/node_modules  # 排除node_modules
    working_dir: /app
    stdin_open: true
    tty: true
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:5000/api/health', (r) => {if(r.statusCode===200)process.exit(0);process.exit(1)})"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### **1.4 创建开发覆盖配置示例**

**docker-compose.override.yml.example:**
```yaml
version: '3.8'

services:
  backend:
    # 开发时增加调试端口
    ports:
      - "5000:5000"
      - "9229:9229"  # Node.js 调试端口
    environment:
      - NODE_ENV=development
      - DEBUG=volunteer:*
    # 开发时可以挂载日志目录
    volumes:
      - ./backend:/app
      - ./logs/backend:/app/logs
      - /app/node_modules
    # 开发命令，支持热重载
    command: npm run dev
  
  # 可选：添加数据库管理工具
  mongo-express:
    image: mongo-express:latest
    container_name: volunteer-mongo-express
    restart: unless-stopped
    ports:
      - "8081:8081"
    environment:
      ME_CONFIG_MONGODB_SERVER: mongodb
      ME_CONFIG_BASICAUTH_USERNAME: admin
      ME_CONFIG_BASICAUTH_PASSWORD: password123
    depends_on:
      - mongodb
    networks:
      - volunteer-network
```

## 🔧 **第二阶段：后端Docker化**

### **2.1 创建后端开发Dockerfile**

**backend/Dockerfile.dev:**
```dockerfile
# 开发环境Dockerfile
FROM node:18-alpine AS development

# 安装必要的系统依赖
RUN apk add --no-cache \
    bash \
    curl \
    git \
    python3 \
    make \
    g++ \
    mongodb-tools

# 设置工作目录
WORKDIR /app

# 复制包管理文件
COPY package*.json ./
COPY yarn.lock ./

# 安装开发依赖（包括devDependencies）
RUN npm ci --include=dev

# 复制源代码
COPY . .

# 创建非root用户（安全最佳实践）
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

# 暴露端口
EXPOSE 5000 9229

# 开发模式启动命令
CMD ["npm", "run", "dev"]
```

### **2.2 创建后端生产Dockerfile**

**backend/Dockerfile:**
```dockerfile
# 多阶段构建：生产环境Dockerfile

# 阶段1: 依赖安装
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY yarn.lock ./
RUN npm ci --only=production

# 阶段2: 构建（如果需要编译）
FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# 如果有TypeScript编译等构建步骤，在这里执行
# RUN npm run build

# 阶段3: 运行时
FROM node:18-alpine AS runner
WORKDIR /app

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 从deps阶段复制生产依赖
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules

# 从builder阶段复制应用代码
COPY --from=builder --chown=nodejs:nodejs /app/src ./src
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/.env.example ./.env

# 切换到非root用户
USER nodejs

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', (r) => {if(r.statusCode===200)process.exit(0);process.exit(1)})"

# 暴露端口
EXPOSE 5000

# 启动命令
CMD ["node", "src/server.js"]
```

### **2.3 更新后端package.json脚本**

**backend/package.json:**
```json
{
  "name": "volunteer-tracker-backend",
  "version": "0.1.0",
  "description": "Backend API for Volunteer Tracker",
  "main": "src/server.js",
  "type": "module",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "docker:dev": "docker-compose up backend",
    "docker:build": "docker build -t volunteer-backend .",
    "docker:build-dev": "docker build -f Dockerfile.dev -t volunteer-backend-dev .",
    "seed": "node src/utils/seedSimple.js",
    "seed:docker": "docker-compose exec backend npm run seed",
    "test": "node scripts/test-simple.js",
    "test:docker": "docker-compose exec backend npm test",
    "reset": "npm run seed",
    "lint": "eslint src/**/*.js",
    "format": "prettier --write \"src/**/*.js\""
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.3.0",
    "express": "^4.18.2",
    "helmet": "^8.1.0",
    "mongoose": "^8.0.0",
    "morgan": "^1.10.1",
    "node-fetch": "^3.3.2"
  },
  "devDependencies": {
    "eslint": "^8.45.0",
    "nodemon": "^3.0.0",
    "prettier": "^3.0.0"
  }
}
```

## 🎨 **第三阶段：开发脚本自动化**

### **3.1 创建开发启动脚本**

**scripts/dev/start.sh:**
```bash
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
```

### **3.2 创建数据库管理脚本**

**scripts/dev/database.sh:**
```bash
#!/bin/bash
# 数据库管理脚本

set -e

case "$1" in
    seed)
        echo "🌱 初始化数据库..."
        docker-compose exec backend npm run seed
        ;;
    reset)
        echo "🔄 重置数据库..."
        docker-compose down -v
        docker-compose up -d mongodb
        sleep 3
        docker-compose exec backend npm run seed
        ;;
    backup)
        echo "💾 备份数据库..."
        BACKUP_FILE="backup-$(date +%Y%m%d-%H%M%S).gz"
        docker-compose exec mongodb mongodump --archive --gzip --db volunteer_tracker > "$BACKUP_FILE"
        echo "✅ 备份完成: $BACKUP_FILE"
        ;;
    restore)
        if [ -z "$2" ]; then
            echo "❌ 请指定备份文件"
            exit 1
        fi
        echo "📤 恢复数据库..."
        docker-compose exec mongodb mongorestore --archive --gzip --db volunteer_tracker < "$2"
        ;;
    shell)
        echo "🐚 进入MongoDB Shell..."
        docker-compose exec mongodb mongosh volunteer_tracker
        ;;
    *)
        echo "📋 数据库管理命令:"
        echo "  ./scripts/dev/database.sh seed     - 初始化数据"
        echo "  ./scripts/dev/database.sh reset   - 重置数据库"
        echo "  ./scripts/dev/database.sh backup  - 备份数据库"
        echo "  ./scripts/dev/database.sh restore <file> - 恢复数据库"
        echo "  ./scripts/dev/database.sh shell   - 进入MongoDB Shell"
        exit 1
        ;;
esac
```

### **3.3 创建Makefile（可选，跨平台）**

**Makefile:**
```makefile
# Volunteer Tracker 开发命令

.PHONY: help start stop restart logs seed test clean

help:
	@echo "📋 志愿者管理系统开发命令"
	@echo ""
	@echo "开发环境:"
	@echo "  make start       启动开发环境"
	@echo "  make stop        停止开发环境"
	@echo "  make restart     重启开发环境"
	@echo "  make logs        查看容器日志"
	@echo ""
	@echo "数据库:"
	@echo "  make seed        初始化数据库"
	@echo "  make db-shell    进入数据库Shell"
	@echo "  make db-reset    重置数据库"
	@echo ""
	@echo "测试:"
	@echo "  make test        运行测试"
	@echo "  make lint        代码检查"
	@echo ""
	@echo "工具:"
	@echo "  make clean       清理临时文件"
	@echo "  make status      查看服务状态"

start:
	@./scripts/dev/start.sh

stop:
	@docker-compose down

restart: stop start

logs:
	@docker-compose logs -f

seed:
	@docker-compose exec backend npm run seed

db-shell:
	@docker-compose exec mongodb mongosh volunteer_tracker

db-reset:
	@docker-compose down -v
	@docker-compose up -d mongodb
	@sleep 3
	@docker-compose exec backend npm run seed

test:
	@docker-compose exec backend npm test

lint:
	@docker-compose exec backend npm run lint

clean:
	@docker system prune -f
	@rm -rf frontend/node_modules backend/node_modules
	@find . -name "*.log" -delete

status:
	@docker-compose ps
	@echo ""
	@echo "🌐 服务状态:"
	@curl -s http://localhost:5000/api/health | python3 -m json.tool || echo "后端服务未运行"
```
