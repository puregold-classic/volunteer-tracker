# 志愿者管理系统 — CLAUDE.md

全球志愿者可视化管理系统。地图展示分布、按部门组织、自管 + 代提交项目支援记录。

**当前 schema 版本**：**v2.1**（2026-04-08 落地）。详见 `backend/prisma/schema.prisma`。

## v2.1 核心模型（最重要）

- **Department**：10 个固定部门（笔译项目部 / 口译项目部 / XZT / 笔译培训部 / 口译培训部 / 文档部 / 推广部 / 技术部 / 人文部 / 管理部）。id 是人类可读 code（"BY_PROJECT" 等），不是 cuid
- **ServiceItem**：~50 个服务项，FK 到 Department，replace 了 v1 的 `ServiceType` enum（翻译/校对/管理/技术）
- **Volunteer**：1:1 绑 Department；`volunteerCode` 是人类 ID（"PG-0001"），`id` 是 cuid（PK）。注意 v1 的 `services[]` 数组、`role` 字段、`nonProjectHours/Count` 累加器都已删除
- **Account ↔ Volunteer**：FK 强约束 1:1。CHECK constraint `role = 'admin' OR volunteerId IS NOT NULL` —— 非 admin 必须绑 volunteer
- **ProjectSupport**（v1 的 `NonProjectService` 改名）：状态机 `ACTIVE / PENDING_CONFIRMATION / REJECTED_BY_OWNER / DELETED`；自提交直接 ACTIVE，代提交（`submittedById ≠ volunteerId`）落到 PENDING_CONFIRMATION 等 owner confirm；partial unique index `(volunteerId, serviceDate, serviceItemId, duration, description) WHERE status='ACTIVE'` 防重
- **SystemSettings**：单行表（id=1），存 `lockedBefore`（月结锁定日期，forward-only）
- **AuditLog**：保留，actionDetails/operator/submitter 是 JSONB 快照

**已删（v1 → v2.1 一刀切）**：`ServiceApplication` 整套审核流（pending/approved/rejected）、`ApplicationType` / `ApplicationStatus` enum、`ServiceType` enum、`PG-0000` admin hack、`PG-9000..9999` 保留 reviewer hack。原 review pipeline 替换为「自管 + DB 防重 + 代提交本人 confirm」。

## 技术栈（实际状态）

**Frontend** (本地开发 port 3000)
- React 18 + TypeScript + Vite
- Tailwind CSS v4 + Radix UI（Slot/Toast 自包，**没有** shadcn/ui）
- 表单：react-hook-form + zod（chunk 6 phase D 起）
- 路由：react-router-dom v7（`BrowserRouter`，2026-04 chunk 3 替代了 v1 手卷的 hash routing）
- Leaflet / react-leaflet（地图）
- 样式：纯 Tailwind。SCSS 已全部删除，sass 依赖已 uninstall。残留：`tailwind.css` 里还有几个旧 CSS class（`.review-page` / `.nps-panel` / `.center-empty` / `.admin-simple-*` / `.auth-form-error`）等台账页 ReviewPage 重做时一起清
- 测试：vitest（单元/hook），Playwright（E2E）

**Backend** (Docker port 5000)
- Node.js ESM + Express
- Prisma ORM 6.19 + PostgreSQL 16（Mongo 已彻底退役）
- JWT + bcrypt
- 角色：`user / b_admin / a_admin / admin`（v2.1 起 admin 唯一允许 `volunteerId=null`）
- 测试：vitest，5 个 service 测试文件，86 tests，~80% line coverage（详见 `backend/vitest.config.js`）
- **架构约定**：controller 只做 HTTP 适配（解析请求 → 调用 service → 映射 HTTP 响应），业务逻辑全部放 `services/`
- **创建账号统一入口**：`AccountService.createVolunteerAccount`（atomic transaction），所有创建路径（admin form / CSV import / register / seed）都走它。**禁止裸调用 `prisma.account.create` 或 `prisma.volunteer.create`**

**Infrastructure**
- 两套 Docker Compose：
  - `docker-compose.yml`：本地开发，只跑 postgres + backend
  - `docker-compose.deploy.yml`：完整 deploy 栈（postgres + backend + nginx-served frontend），单一 80 端口入口
- Mac mini 跑 dev sandbox（`https://dev.puregoldclassictranslation.com`，cloudflared tunnel）。WSL 是开发机。生产走付费云未上
- 仓库：`puregold-classic/volunteer-tracker`
- 详见 `docs/deploy/mac-mini-setup.md`

## 目录结构（v2.1 实际）

```
volunteer-tracker/
├── frontend/src/
│   ├── components/
│   │   ├── AdminCenter/    # 单 admin 面板（v2.1 self-contained）
│   │   ├── HomeMap/        # Leaflet 地图
│   │   ├── VolunteerCard/, VolunteerList/, Header/, Footer/
│   │   ├── shared/, ui/    # ui = Radix-based 自写组件
│   │   └── theme-provider.tsx
│   ├── pages/              # HomePage / LoginPage / MePage / ReviewPage / VolunteerDetailPage
│   ├── services/           # api / authService / volunteerService / projectSupportService /
│   │                       # ledgerService / departmentService / serviceItemService /
│   │                       # systemSettingsService / types.ts (单一真值源)
│   ├── hooks/              # use-toast / useHomeState (v1 hook 间接层 chunk 3 已删)
│   ├── context/            # AuthContext
│   └── e2e/                # Playwright (1 个 home.spec)
├── backend/
│   ├── src/
│   │   ├── controllers/    # auth/volunteer/admin/department/serviceItem/systemSettings/
│   │   │                   # projectSupport/supportLedger/audit/export
│   │   ├── routes/         # 同名
│   │   ├── services/       # AuthService/AccountService/VolunteerService/AdminService/
│   │   │                   # DepartmentService/ServiceItemService/SystemSettingsService/
│   │   │                   # ProjectSupportService/SupportLedgerService/AuditService/ExportService
│   │   ├── startup/        # createInitialAdmin.js (v2.1 没有 PG-0000 hack)
│   │   ├── __tests__/      # 5 个 v2.1 service 单元测试
│   │   ├── middleware/     # authenticate / authorizeReviewer / errorHandler / validateExport
│   │   └── utils/          # serializer / IDGenerator / idUtils / passwordUtils / queryUtils / prismaClient
│   └── prisma/
│       ├── schema.prisma   # v2.1 模型
│       ├── seed.js         # 10 部门 + 50 服务项 + 4 sample 账号
│       └── migrations/
│           └── 20260408..._schema_v2_1/  # 第 3 个 migration，含手工 SQL patch
├── scripts/deploy/         # pg-backup.sh / pg-restore.sh / launchd plist 模板
├── docs/
│   ├── README.md           # 文档索引 + 项目总览
│   ├── architecture.md     # 技术栈 + 模块图 + 数据模型 + 角色权限
│   ├── development.md      # 本地起步 + git workflow + 测试
│   ├── api-overview.md     # v2.1 endpoint 巡览
│   ├── deploy/             # mac-mini-setup.md + backup-strategy.md
│   └── archive/            # v1 时代的设计 / NPS 流程 / chunk-6-plan / stage 拆分等历史
└── docker-compose{,.deploy}.yml + .env.deploy.example + Makefile
```

## 启动开发环境

```bash
# 后端 + 数据库（Docker）
make dev

# 前端（本地）
cd frontend && npm run dev

# 健康检查
curl http://localhost:5000/api/health   # 期望 schemaVersion: "2.1"
```

## 数据库 + 备份

```bash
# 本地 dev (docker-compose.yml)
make seed              # prisma db seed
make db-migrate        # prisma migrate dev (建迁移)
make db-studio         # 可视化
make db-reset          # 完全重置 + 重 seed

# Mac mini sandbox 备份（详见 docs/deploy/backup-strategy.md）
ssh mac 'cd ~/srv/volunteer-tracker && make backup'         # 手动 1 次
ssh mac 'cd ~/srv/volunteer-tracker && make backup-list'    # 列现有
ssh mac 'cd ~/srv/volunteer-tracker && echo RESTORE | make restore'  # 恢复 latest
# 自动调度：launchd plist 装在 ~/Library/LaunchAgents/，每天 03:00 跑
```

## 测试

```bash
make test              # vitest run, ~86 tests, 全 mock 不需要 DB
make test-coverage     # 覆盖率报告
```

## Git 工作流（solo dev）

- `main`：稳定版本，**禁止直接 push**
- `develop`：开发主线，可直接 push
- `feature/*`：可选

## 注意事项 + 历史坑

- 旧的 v1 文档（NPS 审核流 / Mongo / SCSS / hash routing / stages 拆分）已全部移到 `docs/archive/v1-*` 子目录，仅作 history 留存。当前真值源是 `docs/architecture.md` + `prisma/schema.prisma` + 本文件
- `render.yaml` 是历史遗留，不再使用
- `backend/Dockerfile` 在容器启动时自动跑 `prisma migrate deploy` 然后启 server。改了 schema 之后 deploy 重 build 即可
- `backend/.env`（开发）和 `.env.deploy`（部署）都含真实密钥，不得提交；模板用 `.env.deploy.example`
- Admin bootstrap：空库首次启动时，backend 从 `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` env 创建初始 admin。**v2.1 起 admin 的 `volunteerId` 是 null**（不再像 v1 那样塞个假 PG-0000）
- Prisma DSL 不能表达 partial unique index 和 CHECK constraint，所以 `20260408_schema_v2_1` migration 里有 2 处手工 SQL patch（CHECK + dedup partial unique）
- v1 → v2.1 是**破坏性 schema reset**（drop + create），不是 incremental migration。`20260408_schema_v2_1` 这个 migration 的第一段就是 `DROP TABLE`/`DROP TYPE`

## 禁止事项

- 不得硬编码 JWT_SECRET、数据库密码等敏感信息
- 不得直接操作数据库绕过 Prisma
- 不得在 `main` 分支直接 push
- 不得删除 `prisma/migrations/` 中已有的迁移文件
- **不得裸调用 `prisma.account.create` 或 `prisma.volunteer.create`**——必须走 `AccountService.createVolunteerAccount` / `createAdminAccount`，否则容易绕过原子性 + CHECK constraint
