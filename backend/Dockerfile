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