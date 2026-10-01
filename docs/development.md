# 开发指南

## 前置条件

| 工具 | 版本 | 用途 |
|---|---|---|
| Node.js | 20.19+ 或 22.12+（推荐 22 LTS） | frontend dev server，本地装依赖 |
| Docker + Docker Compose | Compose v2.20+ | 跑 backend + postgres |
| Git | — | 你懂的 |
| GNU Make | optional | 命令糖，所有 `make X` 都能在 `Makefile` 里查到等价的原始命令 |

不需要在 host 上装 PostgreSQL / Prisma CLI / libpq —— 全部在 docker 容器里。

---

## 首次拉代码

```bash
git clone git@github.com:puregold-classic/volunteer-tracker.git
cd volunteer-tracker

# Backend 环境变量
cp backend/.env.example backend/.env
# 默认值在本地开发足够了，要改 JWT_SECRET 等可以改

# 启动（自动安装所需依赖）
npm run dev
```

---

## 日常开发

### 启动整套

```bash
# 在仓库根目录执行；make dev / make start 也使用同一脚本
npm run dev
```

脚本按步骤打印：环境和端口检查 → 前端依赖 → Docker 镜像构建 → PostgreSQL、后端依赖、Prisma Client 和待执行迁移 → 后端健康检查 → 前端 → 打开浏览器。首次启动需下载镜像和依赖，后续复用缓存；不会执行 seed 或重置数据库。

网页为 `http://localhost:3000`，前端代理 `/api` 到 `http://localhost:5000`。Docker 引擎须预先启动。脚本支持 Linux / WSL / macOS 自动打开浏览器，无法自动打开时会打印链接；可用 `BROWSER=none npm run dev` 跳过打开。

**按 Ctrl+C 停止前端、后端和 PostgreSQL，保留数据库及依赖数据卷。** 启动中断或失败也会清理已启动的任务。端口 3000 被占用时会提示退出，不会擅自结束已有进程。

后端容器依赖放在独立的 `backend-deps` 数据卷中，不覆盖本机 `backend/node_modules`；前后端依赖在首次运行或依赖清单 / Node 版本变化时通过 `npm ci` 安装。本机单独运行后端测试前，仍需 `cd backend && npm ci && npx prisma generate`。

### 本地快速切换账号

右下角 `DEV · 切换账号` 浮窗可直接切换已有有效账号，无需密码或 admin 解锁。支持按姓名、邮箱、志愿者 ID 搜索，并显示账号角色及圈务身份。切换保留当前地址并重新加载页面，清空上个账号的页面和查询状态；未登录时也能使用，不会创建账号或运行 seed。

此工具只在 Vite 开发模式和后端 `NODE_ENV=development`、`DEV_ACCOUNT_SWITCHER=true` 同时满足时启用。开关仅配置在本地 `docker-compose.yml`；部署测试站使用 production 构建，既不打包浮窗脚本，也不开放切换接口。开发切换签发的登录令牌在测试/生产模式下会被拒绝。修改开关后需重启开发环境。

### 健康检查

```bash
curl http://localhost:5000/api/health
# 期望: {"status":"ok","schemaVersion":"2.1+v4","postgresql":"connected", ...}
```

### 看日志 / 重启

```bash
make logs              # docker compose logs -f
make restart           # 重启所有 service
make stop              # 停掉本地容器（保留数据 volume）
make recover           # backend 依赖出问题时的修复
make status            # 容器状态 + backend 健康检查
```

---

## 数据库 (本地 dev)

```bash
make seed              # prisma db seed → 12 部门 + ~60 service items (带 ServiceCategory) + 4 测试账号
make db-migrate        # prisma migrate dev — 在已有 schema 之上新建 migration
make db-generate       # prisma generate — 重新生成 client 类型
make db-studio         # 打开 prisma studio 可视化 (http://localhost:5555)
make db-reset          # 完全重置：down -v + up + migrate deploy + seed
```

### 测试账号（seed 后）

| email | password | role | volunteer |
|---|---|---|---|
| `admin@vt.local` | `Admin@123` | admin | (none) |
| `b_admin@vt.local` | `Test@1234` | b_admin | PG-0001 |
| `a_admin@vt.local` | `Test@1234` | a_admin | PG-0002 |
| `user@vt.local` | `Test@1234` | user | PG-0003 |

---

## 测试

```bash
# Backend service tests (Vitest, 全 mock 不需要 DB)
cd backend && npm test

# v4 论坛基础集成测试（需 Docker；自动创建并销毁独立 PostgreSQL 16）
cd backend && npm run test:integration:forum

# v4 论坛完整流程（需 Docker 和 Playwright Chromium；独立数据库、真实后端及 Vite）
cd backend && npm run test:e2e:forum

# Frontend unit tests (Vitest + jsdom)
cd frontend && npm test

# 覆盖率
cd backend && npm run test:coverage
cd frontend && npm run test:coverage

# 端到端
cd frontend && npm run test:e2e   # Playwright，启动 Vite preview + 跑 e2e/home.spec.js
```

### 测试覆盖现状

- **Backend**: `src/services/*` 共 5 个 service 单元测试，~80% line coverage（service 层）
- **Frontend**:
  - `useHomeState.test.ts` — 首页过滤状态机
  - `date-utils.test.ts` — 17 个用例覆盖 `parseLocalDate / formatLocalDate / rangeToBounds`（chunk 6 phase E timezone bug 的回归网）
  - `routing.test.ts` — 5 个用例覆盖 `resolveVolunteerCardTarget`（卡片点击三态分流的安全边界）
- **E2E**: 1 个 home.spec.js（landing page smoke）

---

## Git workflow（solo dev）

| 分支 | 用途 |
|---|---|
| `main` | 稳定。**禁止直接 push**，只接受从 `develop` 来的 fast-forward / merge |
| `develop` | 开发主线，可直接 push（solo dev 信任 commit 分组） |
| `feature/*` | 可选，独立 feature 时用 |

提交粒度：每个 commit 一个 coherent unit；commit message 用中文 + emoji prefix（feat / fix / chore / docs / refactor / perf / test 等）+ 简短主题 + 详细 body 解释「为什么」而不是「做了什么」。

部署到 mac mini sandbox：直接 push `develop`，然后 `ssh mac` pull + rebuild（详见 `deploy/mac-mini-setup.md`）。生产环境暂未上线。

---

## 常见痛点

| 症状 | 排查 |
|---|---|
| `make dev` 起不来，backend 报 prisma client 类型不齐 | `make recover`，或 `cd backend && npx prisma generate` |
| 改 schema 后 backend 启动失败 | 确认有跑 `make db-migrate`（dev 期）或 docker rebuild（容器启动时会自动 `migrate deploy`） |
| 前端报 401 但本地是 admin 账号 | JWT 过期或 cookie 没传，看 Network 面板的 `Authorization` header；最简单：退出重登 |
| Prisma 报 partial unique 冲突 | 同人同天同项重复提交，业务行为正确（v2.1 防重） |
| 改了 backend service 后测试爆炸 | 确认 mock 也跟着改了；service 测试是全 mock，schema 改动有时要同步更新测试 fixture |
| 本地 frontend dev 正常但 build 报 tsc 错 | `noUnusedLocals` 是 strict 的，dev mode 不查；build 前手动 `cd frontend && npx tsc --noEmit --skipLibCheck` |

---

## 命令速查

```bash
# 开发循环
make dev && cd frontend && npm run dev

# 改完代码确认编译
cd frontend && npx tsc --noEmit --skipLibCheck && npx vite build

# 改完代码跑测试
cd backend  && npm test
cd frontend && npm test

# 提交 + 推
git add -A && git commit -m "feat(scope): ..." && git push origin develop

# Mac mini 部署（前端改动）
ssh mac 'export PATH=/usr/local/bin:$PATH && cd ~/srv/volunteer-tracker && \
  git pull --ff-only origin develop && \
  docker compose --env-file .env.deploy -f docker-compose.deploy.yml up -d --build frontend'

# Mac mini 部署（前后端都改）
ssh mac 'export PATH=/usr/local/bin:$PATH && cd ~/srv/volunteer-tracker && \
  git pull --ff-only origin develop && \
  docker compose --env-file .env.deploy -f docker-compose.deploy.yml up -d --build backend frontend'
```


## 培训与标签回归

`cd backend && npm run test:e2e:training` 会自动启动隔离 PostgreSQL、临时 API 和 Vite，运行迁移／事务／权限测试及桌面、手机浏览器流程；不使用应用 `.env` 的数据库。仅跑数据库测试用 `npm run test:integration:training`。普通单元测试仍用各目录的 `npm test`。

当前培训入口是 `/training`，普通标签入口是 `/tags`；原始需求见 [计划](training-tags-plan.md)，数据契约、迁移清单格式及最终验收结果见 [升级说明](training-tags-upgrade.md)。
