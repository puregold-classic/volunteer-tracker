# 架构概览

> 本文档配合 `backend/prisma/schema.prisma` 阅读 —— schema 是数据模型的真值源，本文只是导览和上下文。

## 技术栈

### Frontend (`frontend/`)

| 类别 | 选型 | 备注 |
|---|---|---|
| 框架 | React 18 + TypeScript + Vite 7 | |
| 路由 | `react-router-dom` v7（`BrowserRouter`） | chunk 3 替换了 v1 手卷的 hash routing |
| 样式 | Tailwind CSS v4 + Radix UI（`Slot` / `Toast` 自包） | **不用** shadcn/ui；SCSS 已全删 |
| 表单 | `react-hook-form` + `zod` + `@hookform/resolvers` | chunk 6 phase D 起 |
| 地图 | Leaflet + react-leaflet | 自托管 China GeoJSON（`a18af6e`） |
| 测试 | Vitest + Testing Library | 1 e2e（Playwright `e2e/home.spec.js`） |

bundle 拆分（chunk 6 phase E）：vendor / map / forms 三个 manualChunk + 4 个非 landing 页 lazy load + HomePage 内部的 HomeMap 也 lazy load。首屏约 414 kB raw / 125 kB gz。

### Backend (`backend/`)

| 类别 | 选型 | 备注 |
|---|---|---|
| 运行时 | Node.js ESM + Express 4 | |
| ORM | Prisma 6 + PostgreSQL 16 | Mongo 已彻底退役（v1 → v2.1） |
| 鉴权 | JWT + bcrypt | 角色 `user / b_admin / a_admin / admin` |
| 校验 | `express-validator` | |
| 测试 | Vitest，5 个 service 测试，86 tests，~80% line coverage（service 层） | 全 mock，不需要 DB |

### Infrastructure

- **本地开发**：`docker-compose.yml`（postgres + backend），前端 `npm run dev`
- **Mac mini sandbox**：`docker-compose.deploy.yml`（postgres + backend + nginx-served frontend）+ Cloudflare Tunnel + launchd 备份。详见 [`deploy/mac-mini-setup.md`](deploy/mac-mini-setup.md)
- **生产环境**：未上线，待规划

---

## 模块结构

### Frontend (`frontend/src/`)

```
src/
├── pages/                  # 5 张主页面
│   ├── HomePage            # 地图 + 志愿者列表 + 筛选（landing route，eager）
│   ├── MePage              # 个人中心；admin 在这里 inline 渲染 AdminCenter
│   ├── VolunteerDetailPage # 别人的志愿者面板（用 MePage 同款视觉）
│   ├── ReviewPage          # 项目支援台账（admin 只读）
│   └── LoginPage
├── components/
│   ├── HomeMap/            # Leaflet 地图（lazy）
│   ├── VolunteerCard/      VolunteerList/
│   ├── AdminCenter/        # admin 系统管理中心
│   ├── Header/  Footer/
│   ├── ui/                 # Radix-based 自写 primitive (Button/Card/Dialog/Badge/...)
│   └── shared/             # chunk 6 提取的可复用片段：
│       ├── hero-avatar             # 头像
│       ├── support-record-card     # 项目支援卡（MePage / VolunteerDetail 复用）
│       ├── submit-form-dialog      # 提交项目支援对话框（含 locked-proxy 模式）
│       └── form-fields             # FormInput / FormSelect / FormTextarea / FormField
├── services/               # API 客户端
│   ├── api.ts              # axios 实例
│   ├── types.ts            # 单一类型真值源
│   ├── authService / volunteerService / projectSupportService /
│   ├── ledgerService / departmentService / serviceItemService /
│   └── systemSettingsService
├── lib/
│   ├── date-utils.ts       # parseLocalDate / formatLocalDate / rangeToBounds（避开 UTC bug）
│   ├── routing.ts          # resolveVolunteerCardTarget（卡片点击三态分流）
│   └── utils.ts            # cn() helper
├── hooks/                  # use-toast / useHomeState
├── context/                # AuthContext
├── styles/                 # tailwind.css（仅剩 HomeMap 的 leaflet 容器样式）
├── lib/                    # date-utils, routing, utils
├── __tests__/              # vitest 单元测试
└── e2e/                    # Playwright（1 个 home.spec.js）
```

### Backend (`backend/src/`)

```
src/
├── routes/                 # 9 个 route 文件，对应 9 个业务域
├── controllers/            # 同名，仅做 HTTP 适配（请求解析 → 调 service → 映射响应）
├── services/               # 业务逻辑全部在这里
│   ├── AuthService          / AccountService            # 唯一允许创建账号的入口
│   ├── VolunteerService     / DepartmentService
│   ├── ServiceItemService   / SystemSettingsService
│   ├── ProjectSupportService                            # 状态机 + dedup + lock check
│   ├── SupportLedgerService                             # 台账聚合（GFS-friendly raw queries）
│   ├── AuditService                                     # AuditLog 写入
│   └── ExportService                                    # CSV / Excel 导出（纯读）
├── middleware/             # authenticate / authorizeReviewer / errorHandler / validateExport
├── startup/                # createInitialAdmin.js（v2.1 没有 PG-0000 hack）
├── utils/                  # serializer / IDGenerator / passwordUtils / queryUtils / prismaClient
├── __tests__/              # 5 个 service 单元测试
└── server.js               # Express app + route mounting
```

**架构铁律**：controller 只做 HTTP 适配，业务逻辑全部放 service。任何账号创建（admin form / CSV import / register / seed）都必须走 `AccountService.createVolunteerAccount` 或 `createAdminAccount`，**禁止裸调用 `prisma.account.create` / `prisma.volunteer.create`**。

---

## 数据模型概览（v2.1 + v3）

完整定义在 `backend/prisma/schema.prisma`。下面只是关键关系：

```
Department (12 个固定部门, id 是人类可读 code 如 BY_PROJECT; v3 新增 READING_CLUB / VIDEO)
   │
   │ 1:N
   ▼
ServiceItem (~60 个服务项, 带 ServiceCategory enum)
   │     ← v3: 4 板块 PROJECT_MGMT / PROJECT_TRAINING / PROJECT_SUPPORT / TRAINING_ATTENDANCE
   │
   │ N:1   (每条 ProjectSupport 关联一个 service item)
   ▼
ProjectSupport ─── volunteerId ───▶ Volunteer ◀─── 1:1 ─── Account
   │  │                                                      │
   │  │ projectId? ─── N:1 ───▶ Project (v3 新增, 批量考勤/tag)
   │  │
   │  │ submittedById ────────▶ Volunteer (代提交人)
   │                                                          │
   ▼ status                                                   ▼ role
   ACTIVE / PENDING_CONFIRMATION /                  user / b_admin /
   REJECTED_BY_OWNER / DELETED                      a_admin / admin

VolunteerList (v3 新增) ─ ownerId ─▶ Volunteer
   │
   │ 1:N
   ▼
VolunteerListMember ─ volunteerId ─▶ Volunteer (被关注的人)

AuditLog (独立 paper trail，记 volunteer / account / support / project / list 的关键操作)

SystemSettings (单行表，存 lockedBefore — 月结锁定日期)
```

### 关键约束

- **`Account ↔ Volunteer` 强 1:1 FK**：CHECK constraint `role = 'admin' OR volunteerId IS NOT NULL`，非 admin 必须绑 volunteer
- **`ProjectSupport` 防重 partial unique**：`(volunteerId, serviceDate, serviceItemId, duration, description) WHERE status='ACTIVE'`，防止同人同天同项重复提交
- **代提交状态机**：`submittedById ≠ volunteerId` 时普通志愿者代提交落 `PENDING_CONFIRMATION`；**v3 起 `a_admin / b_admin` 代提交直接 `ACTIVE`**（相当于录入员，无需 owner confirm），audit 打 `proxyBypassedConfirm: true`
- **TRAINING_ATTENDANCE 拦截**：service 层拒绝个人提交该类 service item，只允许走 Project 批量考勤入口（v3）
- **Project sessionDuration 冻结**：TRAINING_ATTENDANCE 项目创建后 sessionDuration 不可修改，每次批量入账时 snapshot 到每条 PS
- **月结锁定**：`lockedBefore` 之前的日期不允许新建 / 修改 ProjectSupport，forward-only
- **删除是软删**：`status='DELETED'`，从 ACTIVE 统计中消失但 row 保留，AuditLog 留有删除事件

Prisma DSL 不能表达 partial unique index 和 CHECK constraint，所以 `20260408_schema_v2_1` migration 末尾有 2 处手工 SQL patch。

---

## 角色与权限模型

| 角色 | 创建方式 | volunteerId | 主要能力 |
|---|---|---|---|
| `user` | admin form / CSV import / register | 必须 | 提交自己的 ProjectSupport / 确认或拒绝代提交 / 查看自己的台账 |
| `b_admin` | 同上 | 必须 | + 访问 `/review` 项目支援台账（只读） |
| `a_admin` | 同上 | 必须 | + 月结锁定 / 创建志愿者账号 |
| `admin` | bootstrap env vars / `/admin/admins` 接口 | NULL | + 创建/修改/删除任何账号 / 重置系统 |

`admin` 是唯一可以 `volunteerId=null` 的角色，CHECK constraint 强制保证。`a_admin` 是 v2.1 引入的中间层（v1 没有），主要用来分担 admin 不能离场的依赖。

### 卡片点击的三态分流

`lib/routing.ts → resolveVolunteerCardTarget`：

1. **匿名访问者** → `/login` + 显示「请先登录」toast
2. **登录用户点自己的卡片** → `/me`（直接进个人中心）
3. **登录用户点别人的卡片** → `/volunteers/:id`

这是 chunk 6 phase B 的安全边界，有单元测试覆盖（`__tests__/routing.test.ts`）。

---

## chunk 6 之后的视觉语言

5 张主页面共享一致的 chunk-6 视觉系统：

- **Hero card** + `HeroAvatar`：所有人物相关页面都用同款头像 + 名字 + 部门 + 区域
- **3 mini stat tile**：MePage（本月/本年/累计）、VolunteerDetailPage（累计/本年/条数）、ReviewPage / AdminCenter KPI strip
- **90 天活跃热力条**：MePage 和 VolunteerDetailPage（GitHub 风格）
- **按月分组 + sticky header**：MePage 和 VolunteerDetailPage 的支援记录区
- **chip 状态筛选**：MePage 状态过滤、ReviewPage 日期段过滤、AdminCenter 角色过滤
- **`shared/form-fields` 统一表单 primitive**：FormInput / FormSelect / FormTextarea / FormField，h-10/h-11 + rounded-lg + semantic token
- **drill-down sheet via Dialog**：mobile 底部 sheet / desktop 中间卡，复用 `ui/dialog`

详细的页面层 UI 决策见各 page 文件顶部的 chunk 6 phase 注释。

---

## 关键依赖与禁忌

完整禁忌清单见仓库根 `CLAUDE.md`。下面是文档作者最常踩的坑：

- ❌ 不得硬编码 JWT_SECRET / 数据库密码（用 `.env.deploy`）
- ❌ 不得直接操作数据库绕过 Prisma
- ❌ 不得在 `main` 分支直接 push（solo workflow 走 `develop`）
- ❌ 不得删除 `prisma/migrations/` 中已有的迁移文件
- ❌ 不得裸调用 `prisma.account.create` / `prisma.volunteer.create`，必须走 `AccountService` 入口
- ❌ 不要在 frontend 用 `new Date('YYYY-MM-DD')` 解析日期，会被解读成 UTC 午夜→在负时区漂前一天，用 `lib/date-utils.parseLocalDate`
