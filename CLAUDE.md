# 志愿者管理系统 — CLAUDE.md

全球志愿者可视化管理系统。交互式地图展示志愿者分布，支持多维筛选、审核流程和权限管理。

## 技术栈（当前实际状态）

**Frontend** (本地运行, port 3000)
- React 18 + TypeScript + Vite
- Tailwind CSS v4 + Radix UI（**已完成 SCSS → Tailwind 迁移**，不再使用 .scss）
- Leaflet / react-leaflet（地图）
- 测试：vitest + @testing-library（单元/hook），Playwright（E2E）

**Backend** (Docker, port 5000)
- Node.js ESM + Express
- Prisma ORM + PostgreSQL（已从 MongoDB 迁移完成）
- JWT + bcrypt 认证
- 角色体系：`user` / `b_admin` / `a_admin` / `admin`
- 测试：vitest（service 层单元测试）
- **架构约定**：controller 只做 HTTP 适配（解析请求、调用 service、把结果映射成 HTTP 响应），业务逻辑全部放 `services/`，不要回退到把逻辑写进 controller

**Infrastructure**
- Docker Compose：postgres + backend 容器化，frontend 本地运行
- 仓库：`puregold-classic/volunteer-tracker`
- 部署规划：Mac Mini 自托管 → 未来可能迁移云端

## 目录结构

```
volunteer-tracker/
├── frontend/          # React + TS 前端
│   ├── src/
│   │   ├── components/   # AdminCenter, ReviewCenter, MeCenter, HomeMap 等
│   │   ├── pages/
│   │   ├── services/     # API 调用层
│   │   ├── hooks/
│   │   └── context/
│   └── e2e/              # Playwright 测试
├── backend/
│   ├── src/
│   │   ├── controllers/  # 薄 controller，仅 HTTP 适配
│   │   ├── routes/       # applicationRoutes, auditRoutes, authRoutes 等
│   │   ├── services/     # 业务逻辑层（Auth/Admin/Application/Volunteer/Review/Service）
│   │   ├── __tests__/    # vitest 单元测试
│   │   ├── middleware/
│   │   └── utils/        # serializer, prismaClient 等
│   └── prisma/
│       └── schema.prisma # 数据模型，PostgreSQL + JSONB
├── docs/
│   ├── project/          # 技术规范（部分已过时，以本文件为准）
│   ├── framework/        # 各阶段开发计划
│   └── archive/          # 历史文档
├── docker-compose.yml
└── Makefile
```

## 启动开发环境

```bash
# 启动后端 + 数据库（Docker）
make start
# 或
./scripts/dev/start.sh

# 前端（本地）
cd frontend && npm run dev

# 健康检查
curl http://localhost:5000/api/health
```

## 数据库

- ORM: Prisma，schema 在 `backend/prisma/schema.prisma`
- 模型：Account、Volunteer、ServiceApplication、NonProjectService、AuditLog
- JSONB 字段：`changes`、`submittedBy`、`auditHistory`、`operator`、`submitter`
- 枚举值用中文存储（通过 `@map()`）：在职/不在职、翻译/校对/管理/技术 等

```bash
# 数据库操作
cd backend
npx prisma migrate dev     # 新建迁移
npx prisma generate        # 更新 client
npx prisma studio          # 可视化查看数据
```

## Git 工作流

- `main`：稳定版本，**禁止直接 push**
- `develop`：开发主线，solo dev 模式下可直接 push
- `feature/*`：功能分支，从 develop 切出，完成后 fast-forward 合回 develop

## 注意事项

- `docs/` 中部分文档仍提及 MongoDB，**已过时**，以本文件和 `prisma/schema.prisma` 为准
- 前端没有独立的 Docker 服务，本地 `npm run dev` 运行
- `render.yaml` 是历史遗留，不再使用
- `backend/.env` 包含真实密钥，不得提交
- Prisma 部分 partial unique index 需手动修改迁移 SQL（见 `prisma/migrations/` 注释）

## 禁止事项

- 不得硬编码 JWT_SECRET、数据库密码等敏感信息
- 不得直接操作数据库绕过 Prisma
- 不得在 `main` 分支直接 push
- 不得删除 `prisma/migrations/` 中已有的迁移文件
