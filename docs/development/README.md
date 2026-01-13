# 开发环境设置指南

## 文档介绍

- Design: 开发目标，面板与功能实现
- Git_workflow: git工具及其工作流程
- Technique: 技术应用、接口规定、仓库格式

## 🚀 快速开始

### 前提条件
- Docker & Docker Compose
- Node.js 18+ (仅前端开发需要)
- Git

### 首次设置

**Bash操作流程：**

```bash
# 1. 克隆仓库
git clone git@github.com:puregold-classic/volunteer-tracker.git
cd volunteer-tracker

# 2. 复制环境配置文件
cp .env.development.example .env.development
cp docker-compose.override.yml.example docker-compose.override.yml

# 3. 安装前端依赖
cd frontend && npm install && cd ..

## 需要先启动docker
# 4. 启动开发环境
# 需要安装make命令
# 若无make命令，请打开makefile文件对照指定命令
# 或使用更简单的scripts操作流程
make start
```

**scripts操作流程（推荐）：**

```bash
# 1. 克隆仓库
git clone git@github.com:puregold-classic/volunteer-tracker.git
cd volunteer-tracker

## 需要先启动docker

# 2. 启动脚本
chmod +x ./scripts/dev/start.sh
./scripts/dev/start.sh

# 3. 数据库初始化脚本
chmod +x ./scripts/dev/database.sh
./scripts/dev/database.sh
```

## ai辅助编程指南

首先要让ai理解项目背景。
这是一个什么项目？当前进行到哪里？要实现什么效果？告知AI这三个问题，有助于回复收敛。
什么项目？进行到哪里？

```bash
# 前端任务：
cd frontend
npm run analyze
npm run analyze:quick

# 后端任务：
cd backend
npm run analyze
npm run analyze:quick
```

然后直接复制./frontend或者./frontend下生成的总结文档，发送给ai

要实现什么效果？

## 🐳 容器化开发环境

### 架构概述
```text
开发时:
  - 前端: 本地运行 (localhost:3000)
  - 后端: Docker容器 (localhost:5000)
  - 数据库: Docker容器 (localhost:27017)
```

### 可用服务
- 前端应用: http://localhost:3000
- 后端API: http://localhost:5000
- 健康检查: http://localhost:5000/api/health
- 数据库管理: http://localhost:27017

## 📝 常用开发命令

### 使用 Makefile (推荐)
```bash
# 启动所有服务
make start

# 查看日志
make logs

# 停止服务
make stop

# 初始化数据库
make seed

# 运行测试
make test
```

### 使用 Docker Compose 直接操作
```bash
# 启动特定服务
docker-compose up backend

# 重建服务
docker-compose up --build backend

# 查看服务状态
docker-compose ps

# 进入容器Shell
docker-compose exec backend sh
```

## 🔧 开发工作流

### 前端开发
```bash
cd frontend
npm run dev  # 开发服务器
npm run build  # 生产构建
npm run test   # 运行测试
```

### 后端开发
```bash
cd backend
npm run dev    # 开发模式 (通过Docker)
npm run test   # 运行测试
npm run lint   # 代码检查
```

### 数据库操作
```bash
# 重置数据库
make db-reset

# 进入MongoDB Shell
make db-shell

# 备份数据库
./scripts/dev/database.sh backup

# 恢复数据库
./scripts/dev/database.sh restore backup-20240101.gz
```

## 🐛 故障排除

### 常见问题
1. **端口冲突**
    检查 3000、5000、27017 端口是否被占用

2. **容器启动失败**
    ```bash
    # 查看详细日志
    docker-compose logs --tail=50 backend

    # 重建服务
    docker-compose up --build --force-recreate backend
    ```

3. **数据库连接失败**
    ```bash
    # 检查MongoDB状态
    docker-compose exec mongodb mongosh --eval "db.adminCommand('ping')"

    # 重启数据库
    docker-compose restart mongodb
    ```

### 清理资源
```bash
# 清理Docker资源
make clean

# 清理所有容器和卷
docker-compose down -v
docker system prune -af
```

## 🔗 相关文档
- API文档
- 部署指南
- 故障排除
