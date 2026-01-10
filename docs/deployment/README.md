# 部署指南

## 📦 生产环境部署

### 前提条件
- Docker & Docker Compose
- 域名和SSL证书
- 云服务器或VPS

### 部署步骤
```bash
# 1. 克隆代码
git clone <repository-url>
cd volunteer-tracker

# 2. 配置生产环境
cp .env.production.example .env.production
vim .env.production  # 编辑配置

# 3. 构建镜像
docker-compose -f docker-compose.yml -f docker/production/docker-compose.production.yml build

# 4. 启动服务
docker-compose -f docker-compose.yml -f docker/production/docker-compose.production.yml up -d
```

## 🐳 容器编排（可选）

### Docker Swarm 部署
```bash
# 初始化Swarm
docker swarm init

# 部署堆栈
docker stack deploy -c docker-compose.yml -c docker/production/docker-compose.production.yml volunteer
```

### Kubernetes 部署
请参考 kubernetes/ 目录下的配置文件。

## 🔒 安全建议

### 环境变量
- 使用强密码和密钥
- 定期轮换凭据
- 使用密钥管理服务

### 网络安全
- 配置防火墙规则
- 启用SSL/TLS
- 限制数据库外部访问

## 📊 监控和日志

### 日志收集
```bash
# 查看实时日志
docker-compose logs -f

# 导出日志
docker-compose logs > app.log
```

### 健康检查
- 定期访问 /api/health
- 设置监控告警
- 配置自动恢复

## 🔄 更新流程

### 滚动更新
```bash
# 拉取最新代码
git pull origin main

# 重建服务
docker-compose build
docker-compose up -d
```

### 回滚
```bash
# 恢复到上一个版本
docker-compose up -d --force-recreate --no-deps backend
```

## 🚀 第五阶段：验证和实施

### 5.1 给脚本添加执行权限
```bash
chmod +x scripts/dev/*.sh
chmod +x scripts/deploy/*.sh
chmod +x scripts/test/*.sh
```

### 5.2 创建.gitignore更新
.gitignore添加内容：
```text
# 环境文件
.env
.env.local
.env.*.local
docker-compose.override.yml

# 日志文件
logs/
*.log

# 备份文件
*.gz
backup-*.gz

# 临时文件
tmp/
```

### 5.3 验证步骤
```bash
# 1. 测试开发环境启动
./scripts/dev/start.sh

# 2. 测试数据库管理
./scripts/dev/database.sh seed

# 3. 测试服务健康
curl http://localhost:5000/api/health

# 4. 测试前端访问
# 打开浏览器访问 http://localhost:3000
```
