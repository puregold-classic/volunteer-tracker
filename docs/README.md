# 志愿者管理系统 — 文档索引

全球志愿者可视化管理系统。地图展示分布、按部门组织、自管 + 代提交项目支援记录。

**当前版本**：schema **v2.1 + v3 增量**（v2.1 于 2026-04-08 破坏性 reset；v3 于 2026-04-17 上线前落地，增 `ServiceCategory` / `Project` / `VolunteerList` 三块 + 台账重构 + 视觉重做）。

---

## 文档地图

### 入门与开发
- **[architecture.md](architecture.md)** — 技术栈、模块结构、数据模型概览、角色权限模型
- **[development.md](development.md)** — 本地开发环境、git workflow、测试约定
- **[api-overview.md](api-overview.md)** — API endpoint 巡览（按业务域分组，含 v3 新增的 `/projects` / `/lists` / 台账多个新端点）

### 部署与运维
- **[deploy/mac-mini-setup.md](deploy/mac-mini-setup.md)** — Mac mini sandbox 完整部署清单（域名 → Cloudflare Tunnel → launchd 服务）
- **[deploy/backup-strategy.md](deploy/backup-strategy.md)** — pg_dump GFS rotation + iCloud Drive 离机冗余策略

### 历史 / 已归档
- **[archive/](archive/)** — v1（Mongo + 哈希路由 + SCSS 时代）的设计文档、stage 拆分、NPS 审核流程、chunk 6 计划等。**仅作 history 留存，不再代表系统当前形态**，新人请先读上面的活文档

---

## 项目源码地图

文档不会重复源码已有的信息。下面这些是真正的「源头」，文档只是导览：

| 你想看 | 直接读这个 |
|---|---|
| 数据库 schema | `backend/prisma/schema.prisma` |
| API 路由清单 | `backend/src/routes/*.js` |
| 业务逻辑 | `backend/src/services/*.js` |
| 业务规则原子性入口 | `backend/src/services/AccountService.js`（v2.1 起所有账号创建必须走它） |
| 前端页面 | `frontend/src/pages/*.tsx` |
| 前端共享组件 | `frontend/src/components/shared/`（HeroAvatar / SupportRecordCard / SubmitFormDialog / FormField 等） |
| 前端类型定义 | `frontend/src/services/types.ts`（单一真值源） |
| 全局约定 + 历史坑 | 仓库根的 `CLAUDE.md` |
| 快捷命令 | 仓库根的 `Makefile`（`make help`） |

---

## 命名 / 概念速查

| 词 | 含义 |
|---|---|
| **v2.1** | 2026-04-08 的破坏性 schema reset。删了 v1 的审核队列 / nonProjectService / 各种 enum / PG-0000 admin hack |
| **v3** | 2026-04-17 的上线前增量。加 `ServiceCategory` 四板块（项目管理/培训/支持/受训考勤）+ `Project` 一等实体（批量考勤）+ `VolunteerList`（我的关注）+ 台账 3 级 drill |
| **chunk 6** | 2026-04 的前端视觉重做。Tailwind v4 + react-router v7 + react-hook-form + 5 张主页面全 chunk-6 化 |
| **ProjectSupport** | 项目支援记录（v1 叫 NonProjectService / NPS） |
| **Project** | v3 新增。一个具体的 session/项目实例（如某次培训），批量考勤入账 + 个人支援可贴 tag |
| **ServiceCategory** | v3 新增 enum：`PROJECT_MGMT` / `PROJECT_TRAINING` / `PROJECT_SUPPORT` / `TRAINING_ATTENDANCE` |
| **我的关注 / VolunteerList** | v3 新增。私有 per-owner 跟踪名单，MVP 只开默认 list "我的关注" |
| **代提交 / proxy submission** | 由 A 提交但 volunteerId 是 B 的记录，状态机 PENDING_CONFIRMATION，等 B 确认。v3 起 a_admin/b_admin 代提交免 confirm |
| **AdminCenter** | admin 登录后 `/me` 渲染的系统管理界面（不是单独的路由） |
| **台账 / SupportLedger** | admin 只读的项目支援聚合视图，路径 `/review`。v3 起支持 category 筛选 + 部门/服务/志愿者 3 级 drill |
| **GFS rotation** | 备份保留策略：7 daily + 4 weekly + 12 monthly + N yearly |
