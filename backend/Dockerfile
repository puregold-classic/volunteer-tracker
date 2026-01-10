# 生产环境Dockerfile - 针对Render优化
FROM node:18-alpine AS builder

# 安装必要的工具
RUN apk add --no-cache python3 make g++ git

WORKDIR /app

# 复制依赖文件
COPY package*.json ./

# 清理npm缓存并安装依赖
RUN npm cache clean --force && \
    npm ci --only=production

# 复制源代码
COPY . .

# 运行时阶段
FROM node:18-alpine AS runner

WORKDIR /app

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 从构建阶段复制文件
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/src ./src
COPY --from=builder --chown=nodejs:nodejs /app/.env.example ./.env

# 切换到非root用户
USER nodejs

# 暴露端口 - Render要求监听所有接口
EXPOSE 10000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:10000/api/health', (r) => {if(r.statusCode===200)process.exit(0);process.exit(1)})"

# 启动命令 - 重要：Render使用10000端口
CMD ["node", "src/server.js"]