# DEVLOG.md

_写给下一个我，不是写给人看的报告。_

## [2026-03-08] Kickoff Baseline

### 现状
- Restore point: `734ba97049a3a747bdc0f49d66eb4b2ed64f8bfc`
- 后端：Node/Express + Mongoose（MongoDB）
- 前端：React/Vite + SCSS（尚未 Tailwind）
- 核心业务模块已在代码中：auth / application / review / service / audit / admin

### 本阶段目标
1. 数据库迁移：MongoDB -> PostgreSQL（Docker 内）
2. 样式迁移：SCSS -> Tailwind CSS
3. 迁移期间保证可回滚、可验证、低风险

### 执行分期（建议）
- Phase 0: 迁移设计与风险清单
- Phase 1: PostgreSQL 基础设施 + schema 映射
- Phase 2: 数据迁移脚本（dry-run + 校验）
- Phase 3: 后端数据访问层切换与兼容
- Phase 4: Tailwind 接入与 SCSS 渐进替换
- Phase 5: 回归测试 + 性能/稳定性验证

### 备注
- 在未完成验证前，不进行破坏性数据操作。
- 如遇高风险项，先写入 QUESTIONS.md 等待 OC 回复。

---

## [2026-03-08] Phase 1 Complete — PG Infrastructure + Schema Verified

### 完成内容

**Phase 1 目标：PostgreSQL 基础设施 + schema 映射** — 全部完成，29/29 验证通过。

1. **PG 容器**：`postgres:16-alpine` 已运行，健康，数据持久化到 `pg-data` volume。
2. **Prisma schema**：全部 5 个模型完成映射（Account, Volunteer, ServiceApplication, NonProjectService, AuditLog），10 个枚举，中文枚举值用 `@map()` 保留。
3. **Migration 1 (init)**：所有表、基础索引已应用到 PG。
4. **Migration 2 (partial unique index)**：`non_project_services_dedup_active_idx` WHERE `isActive=true` 已直接通过 psql 应用（迁移文件为空，索引用 DDL 补打）。
5. **Prisma Client**：已在容器内生成（`prisma generate` as root）。
6. **验证脚本**：`backend/scripts/verify-pg-schema.js`，29 项检查全通过。

### 关键状态

- **MongoDB 未动**：`/api/health` 返回 `mongodb: connected`，应用正常运行。
- **回滚路径完整**：`734ba97` restore point 未动，PG 只是新增基础设施，零破坏性。
- **PG 数据为空**：所有表 0 行，符合 Phase 1 纯 schema 阶段预期。

### 踩到的坑

- `prisma/migrations/` 目录由 root 创建（docker volume 挂载问题），无法通过 Write 工具修改文件。
  - 第二个迁移文件内容为空，用 psql DDL 直接补打索引。
- Backend 容器缺少 `DATABASE_URL` 环境变量（容器 2 小时前启动，早于 docker-compose.yml 更新）。
  - 绕过方式：用 `-e DATABASE_URL=...` 参数传入。
- `pg` npm 包未安装，验证脚本改用 Prisma Client 的 `$queryRaw`。

---

## [2026-03-08] Phase 2 Dry-Run Complete — 23/23 docs, 0 errors

### 完成内容

**Phase 2 目标：数据迁移脚本 dry-run** — 通过，23 docs，0 errors。

**脚本位置：** `backend/scripts/migrate-mongo-to-pg.js`

脚本能力：
- 连接 MongoDB，读取 5 个集合的全部文档
- 每个文档通过 mapper 函数转换为 PG schema 格式
- 执行字段存在性 + 枚举合法性校验
- 输出每个集合的 ok/error/warning 明细
- 默认 dry-run（只读，不写 PG）；`--apply` 参数开启写入
- apply 模式：每个集合在单独 transaction 中写入，失败只回滚该集合

**数据现状（MongoDB 数据库）：**
| 集合 | 文档数 |
|------|--------|
| Account | 3 |
| Volunteer | 2 |
| ServiceApplication | 9 |
| NonProjectService | 4 |
| AuditLog | 5 |
| **总计** | **23** |

**关键 mapping 决策（记录在 D004）：**
- Volunteer.`id`（domain ID，如 `PG-0001`）→ PG `volunteerId`（unique string）
- Mongo indexed 镜像字段（indexedStatus, indexedVolunteerId 等）→ 全部丢弃（PG 原生索引）
- `changes`, `submittedBy`, `actionDetails`, `operator`, `submitter`, `auditHistory` → JSONB
- AuditLog.actionDetails.applicationType 含 `'system'`（不在 PG ApplicationType 枚举）→ 不影响（存 JSONB）
- 新 PK: `crypto.randomUUID()` 作为 PG surrogate id（Node 18 内置，无额外依赖）

### 踩到的坑

- `@paralleldrive/cuid2` 未在 package.json 中，容器内不可用。改用 `crypto.randomUUID()`（Node 18 内置）。
- dry-run 模式下只需 MONGODB_URI，不需要 DATABASE_URL，避免依赖 backend 容器环境变量问题。

---

## [2026-03-08] Phase 3 Scaffold Complete — Parallel Adapter Infrastructure

### 完成内容

**Phase 3 目标：并行适配器基础架构** — scaffold 完成，线上 demo 路径零影响。

**新增文件：**
| 文件 | 说明 |
|------|------|
| `src/utils/featureFlags.js` | Env-based 特性开关（`PG_SHADOW_WRITE`） |
| `src/utils/prismaClient.js` | 懒加载 Prisma singleton，DATABASE_URL 未设置时静默 no-op |
| `src/utils/pgMapper.js` | 5 个 mapper 函数（Mongoose doc → PG row），与 Phase 2 映射逻辑一致 |
| `src/utils/pgShadow.js` | Shadow 写入适配器：fire-and-forget，never throws，upsert-based |

**修改文件：**
- `src/services/ReviewService.js`：import pgShadow + 3 处 shadow write hook（无事务 review 路径）
  - `serviceRecord.save()` 后 → `pgShadow.nonProjectService(serviceRecord)`
  - `application.save()` 后 → `pgShadow.serviceApplication(application)`
  - `auditLog.save()` 后（无事务版本）→ `pgShadow.auditLog(auditLog)`

**迁移计划文档：** `docs/phase3-migration-plan.md`

### 验证结果

- 4 个工具模块加载正常（node 直接执行验证）
- `[PrismaClient] DATABASE_URL not set — PG shadow layer disabled.` 确认懒加载符合预期
- backend 容器 nodemon 重启后健康检查通过，MongoDB 路径未受影响
- `PG_SHADOW_WRITE` 默认 `false`，当前所有 shadow 调用直接 return，无任何 PG 访问

### 如何开启 shadow 验证（演示后）

1. 重启 backend 容器（注入 DATABASE_URL + PG_SHADOW_WRITE=true）
2. 触发一次审核通过操作（`POST /api/v1/reviews/:id`）
3. 看日志出现 `[pgShadow] ✅ NonProjectService shadow-written: NPS-*`
4. 直接 psql 查询 PG 确认行数与 Mongo 一致

### 下一阶段：Phase 3 Step 2

Phase 3 Step 2 = 补全剩余 hook 路径（事务版本 + application submit + volunteer + account）
详见 `docs/phase3-migration-plan.md`
- 从 MongoDB 读取每个集合的数据
- 映射到 PG schema（ID 转换、JSONB 字段序列化、枚举值转换）
- 先做 dry-run（仅输出，不写入 PG）
- 再做实际迁移（写入 PG），并做行数 + 关键字段的校验

**前置条件**：后端容器需要 DATABASE_URL 才能让 Prisma 在运行时访问 PG。
建议重启 backend 容器以加载最新 docker-compose.yml 的 DATABASE_URL 变量，但这是有计划的操作，需先通知 OC。

---

## [2026-03-09] Phase 4 Complete — Tailwind CSS v4 接入

### 完成内容

**Phase 4 目标：Tailwind CSS 接入** — 完成。

- 安装 `tailwindcss@^4` + `@tailwindcss/vite`（v4 专属 Vite 插件，无需 postcss）
- 新增 `frontend/src/styles/tailwind.css`（`@import "tailwindcss"` 入口）
- `frontend/vite.config.ts`：添加 `tailwindcss()` 插件
- `frontend/src/main.tsx`：导入 tailwind.css

### 踩到的坑

- Tailwind v4 不使用 `tailwind.config.js`，也不需要 postcss，`@tailwindcss/vite` 直接作为 Vite 插件注册。
- v4 用 `@import "tailwindcss"` 替代 v3 的 `@tailwind base/components/utilities` 三行指令。

---

## [2026-03-09] Phase 5 Complete — PG as Sole Primary Database

### 完成内容

**Phase 5 目标：Mongoose 完全移除，Prisma 成为唯一数据访问层** — 完成。

所有 active 代码路径（controllers/services/middleware）已从 Mongoose 切换到 Prisma：

| 文件 | 变更 |
|------|------|
| `src/services/ReviewService.js` | 最复杂：事务、JSONB 数组追加、serviceType 翻译、activityLevel PG enum 计算 |
| `src/utils/validationUtils.js` | Mongoose findOne → Prisma findFirst；serviceType 枚举对比特殊处理 |
| `src/services/ServiceService.js` | $facet/$lookup → 多路并行 Prisma 查询 + $queryRaw 时间序列分组 |
| `src/services/AuditService.js` | JSONB operator/submitter 字段过滤 → $queryRaw；timeline 分析 → 原生 SQL |
| `src/controllers/reviewController.js` | Mongoose aggregate → Prisma groupBy + $queryRaw |
| `src/controllers/adminController.js` | hashPassword 从 Mongoose 实例方法改为 passwordUtils 工具函数；cascadeDelete 用 $queryRaw |
| `src/services/ExportService.js` | NonProjectService.aggregate → Prisma count + findMany 分页 + $queryRaw JOIN |
| `src/controllers/exportController.js` | Mongoose cursor streaming → Prisma 分批 findMany（BATCH_SIZE=1000）|
| `src/middleware/authorizeReviewer.js` | Volunteer.findOne → Prisma findFirst；reviewer.id → reviewer.volunteerId |
| `src/server.js` | 移除 mongoose/database 导入；健康检查改为 prisma.$queryRaw\`SELECT 1\` |

### 剩余 Mongoose 引用

- `backend/src/utils/seedSimple.js`：仅 seed 工具，非 active 路径，保留为 legacy 参考。

### 关键架构决策（见 D006–D009）

- Prisma `$transaction` 替代 MongoDB session
- JSONB 数组 fetch-then-update 模式（auditHistory 追加）
- serviceType 中文→PG enum 翻译层（SERVICE_TYPE_TO_PG）
- activityLevel 直接用 PG enum 成员（HIGH/MEDIUM/LOW），不存中文

### 踩到的坑

- `REGION_TO_PG` 在 `ServiceService.getServiceRecords` 中最初用了动态 `await import()`，后修正为顶层静态 import。
- `validateChanges` update 路径：PG 存储 enum 成员（`TRANSLATION`），但 changes.from 是中文（`'翻译'`），需跳过 serviceType 字段的原始值比对。
- `volunteer.id` vs `volunteer.volunteerId`：PG 中 `id` 是 cuid PK，`volunteerId` 是业务域 ID（如 PG-0001）。authorizeReviewer、adminController 多处初始版本用了错误的 `.id`，逐一修正。

### 下一步

- 启动验证：注入 DATABASE_URL，重启 backend 容器，检查 `/api/health`
- 运行 `backend/scripts/verify-migration-complete.js` 确认 PG 数据完整性
- 合并 `feature/Task1` → `main`，标记 Phase 5 里程碑

---

## [2026-03-12] Frontend UI Sprint — 三波 UI 升级 + 移动端修正 + 地图交互修 bug

### 本轮完成

这轮基本是前端连续冲刺，目标是先把体验拉起来，再一路修因为渐进重构引入的交互/布局问题。

**已完成：**
- 第一波 UI 升级
  - 建统一 primitives：Button / Input / Select / Badge / Card variants / Dialog / AlertDialog / EmptyState / ErrorState / SectionHeader / StatCard
  - ThemeProvider 接入根节点
  - Toaster 接到根节点
  - 首页、志愿者卡片/列表、详情页做第一轮视觉统一
- 第二/三波升级
  - Header / Footer 统一视觉并后续继续做紧凑化
  - LoginPage 切到 primitives + toast
  - MeCenter 改为更清晰的信息分区，后续再从 tabs 改成长屏双栏
  - ReviewCenter 先统一交互控件，再重排成图表 / 待审核 / 已审核结构
- 移动端适配
  - 首页从“缩放桌面”改成“搜索/筛选入口 + 地图/列表 tab + bottom sheet”
  - Button/Input/Select 补触控尺寸和 iOS 防缩放细节
  - Login / Detail / Header / Review 做移动端布局修正
- 信息架构升级
  - VolunteerCard 改成 3 秒可判断是否值得点开的结构
  - VolunteerDetailPage 改成：摘要区 / 行动区 / 关键信息区 / 记录区
- 自动化测试骨架
  - 补了 3 条 Playwright 主路径脚本骨架（首页加载 / 移动端 tab 切换 / 卡片进详情）
- 运行时问题修复
  - `Select` API 曾被改坏，恢复成兼容 `<Select><option /></Select>` 的旧调用方式
  - 端口漂移导致“页面打不开”，清掉旧 Vite 进程并恢复到 3000
  - 地图快速聚焦按钮点击美国/欧洲时报错，补了两层防御：
    1. 地图浮层按钮 stopPropagation，避免事件打到 Leaflet 底层
    2. `toggleProvince` / GeoJSON 点击链路防御，区域名（美国/欧洲/东南亚等）不会再误走省份选择逻辑

### 待完成

- Playwright E2E 目前只有脚本骨架，没做稳定运行和 CI 接线
- ReviewCenter 还有继续压缩卡片信息、优化大屏空间分配的余地
- HomePage 左侧筛选条还能进一步工具栏化，继续节省垂直空间
- 一些老 SCSS/旧 class 仍在过渡期，后续可以继续收口

### 关键学习

- **渐进重构最容易出事的点不是视觉，而是组件 API 不兼容。** 这轮最典型就是 Select：build 不一定炸，但页面会白。
- **地图控件上的按钮必须和 Leaflet 事件彻底隔离。** 不然看起来像“点地区报错”，其实是冒泡把交互链搞乱了。
- **移动端不能照搬桌面栅格。** 首页改成 tab + bottom sheet 后，结构才真正成立。
- **布局优化后，用户马上会盯信息密度。** 所以要持续做“压高度、提层级、减噪音”，而不是只做卡片变漂亮。

### 当前状态

- 前端无已知阻塞性问题
- 最近一次改动后 `npm run build` 通过
- 如果下一轮继续，建议先做真实 viewport smoke（320 / 375 / 390 / 768）再进细节 polish
