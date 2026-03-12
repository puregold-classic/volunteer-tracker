# MongoDB → PostgreSQL 迁移 — 阶段归档

_归档时间：2026-03-09_

---

## Phase 1 — PG 基础设施 + Schema 映射

**状态：DONE ✅**
**时间：2026-03-08**

### done
- `postgres:16-alpine` 容器运行，healthy，数据持久化到 `pg-data` volume
- Prisma schema：5 模型（Account, Volunteer, ServiceApplication, NonProjectService, AuditLog），10 枚举
- Migration 1 (init) 已应用，所有表 + 基础索引
- Migration 2 (partial unique index)：`non_project_services_dedup_active_idx` WHERE `isActive=true`，通过 psql DDL 补打
- Prisma Client 已在容器内生成
- 验证脚本 `backend/scripts/verify-pg-schema.js`：29/29 通过

### decisions
- D001: Prisma 作为数据访问层（owner 批准，Q001）
- D002: Migration 2 空文件 + 手动 DDL（见 DECISIONS.md）
- 短停机窗口策略批准（Q003，owner confirmed）

### risks（已解除）
- Migration 2 文件内容为空（checksum 原因用 DDL 直接补打），非标准但可接受
- `prisma/migrations/` 目录为 root 所有权（docker volume 挂载问题），Read/Write 工具无法操作，用 docker exec 绕过

---

## Phase 2 — 数据迁移脚本 + Apply + Shadow Writes 激活

**状态：DONE ✅**
**时间：2026-03-08**

### done
- `backend/scripts/migrate-mongo-to-pg.js`：dry-run 通过，23/23 docs，0 errors
- apply 通过：Account:3 / Volunteer:2 / ServiceApplication:11 / NonProjectService:5 / AuditLog:7
- `backend/scripts/verify-migration-complete.js`：65/65 通过
- PG_SHADOW_WRITE=true 注入，shadow writes 激活
- backend 重启后 Prisma 初始化：`[Prisma client initialised (PG shadow layer ready)]`

### decisions
- Volunteer domain ID（如 `PG-0001`）→ PG `volunteerId`（unique string）
- Mongo indexed 镜像字段 → 丢弃（PG 原生索引替代）
- JSONB 字段：changes, submittedBy, actionDetails, operator, submitter, auditHistory
- 新 PK：`crypto.randomUUID()`（Node 18 内置，无额外依赖）
- ENUM_MAP：Mongo 中文值 → Prisma 英文成员名（ACTIVE/INACTIVE 等）

### risks（已解除）
- 枚举翻译缺失 bug（pgMapper.js + migrate-mongo-to-pg.js），apply 前修复
- `@paralleldrive/cuid2` 容器内不可用，改用 crypto.randomUUID

---

## Phase 3 — 并行适配器 + Shadow Writes Burn-in

**状态：DONE ✅**
**时间：2026-03-08，OC 签字：2026-03-09**

### done
- 新增 4 个工具模块：featureFlags.js / prismaClient.js / pgMapper.js / pgShadow.js
- 15 个 shadow write hooks 覆盖全部主要写入路径
- Burn-in 通过，门控 6/6 全通过（OC Q013 签字确认）
- 文档：docs/apply-runbook.md / docs/phase3-migration-plan.md / docs/phase5-regression-plan.md

### decisions
- Phase 4 路线：方案 A — Tailwind 先行，PG 切主后置（OC 批准，2026-03-09，Q013）
- 有意跳过：`deactivateAllMyApplications`（updateMany）、`deleteVolunteer`（硬删除）

---

## Phase 4 — Tailwind CSS 接入

**状态：DONE ✅**
**时间：2026-03-09**

### done
- 安装 `tailwindcss@^4` + `@tailwindcss/vite`（v4 原生 Vite 插件，无需 postcss）
- 新增 `frontend/src/styles/tailwind.css`（`@import "tailwindcss"` 入口）
- `frontend/vite.config.ts`：添加 `tailwindcss()` 插件
- `frontend/src/main.tsx`：导入 tailwind.css

### decisions
- 方案 A：渐进替换，新改动优先用 Tailwind，逐页替换旧 SCSS（OC Q013 批准）
- PG 切主延后到 Tailwind 完成后统一回归 → Phase 5 实际与 Phase 4 同批交付

### lessons
- Tailwind v4 彻底重写了 Vite 接入方式：`@tailwindcss/vite` 插件取代 postcss；`@import "tailwindcss"` 取代三行 `@tailwind` 指令；不再需要 `tailwind.config.js`。
- 如果文档搜到的是 v3 配置，直接报错说 `tailwind.config.js not found`——这不是 bug，是 v4 故意的。

---

## Phase 5 — PG 成为唯一数据库（Mongoose 完全移除）

**状态：DONE ✅**
**时间：2026-03-09**

### done
所有 active 代码路径（10 个文件）从 Mongoose 切换到 Prisma：

| 文件 | 核心变更 |
|------|----------|
| `src/services/ReviewService.js` | 最复杂：$transaction、JSONB 数组追加、serviceType 翻译、activityLevel PG enum |
| `src/utils/validationUtils.js` | findOne → findFirst；serviceType 枚举对比特殊处理 |
| `src/services/ServiceService.js` | $facet/$lookup → 多路并行查询 + $queryRaw 时间序列 |
| `src/services/AuditService.js` | JSONB operator/submitter 过滤 → $queryRaw |
| `src/controllers/reviewController.js` | Mongoose aggregate → Prisma groupBy + $queryRaw |
| `src/controllers/adminController.js` | hashPassword 改为工具函数；级联删除用 $queryRaw |
| `src/services/ExportService.js` | aggregate → count + 分页 findMany + $queryRaw JOIN |
| `src/controllers/exportController.js` | Mongoose cursor → Prisma 分批 findMany（BATCH_SIZE=1000） |
| `src/middleware/authorizeReviewer.js` | findOne → findFirst；.id → .volunteerId |
| `src/server.js` | 移除 mongoose/database；健康检查改为 prisma.$queryRaw\`SELECT 1\` |

**剩余 Mongoose 引用：** `backend/src/utils/seedSimple.js`（仅 seed 工具，非 active 路径，保留为 legacy 参考）

### decisions
- D006: Prisma `$transaction` 替代 MongoDB session（删除 `isTransactionUnsupported` fallback）
- D007: JSONB 数组 fetch-then-update（auditHistory 追加）
- D008: serviceType 中文↔PG enum 翻译层（`SERVICE_TYPE_TO_PG`）
- D009: `$queryRaw` 用于 JSONB 嵌套字段过滤（Prisma where 子句不支持 `->>`）

### lessons（重要，下一个我必读）
1. **`volunteer.id` vs `volunteer.volunteerId`**：PG 中 `id` 是 cuid PK，`volunteerId` 才是业务域 ID（`PG-0001`）。所有外键引用都是 `volunteerId`。在 middleware/controller 里经常写错，每次写 `reviewer.id` 或 `volunteer.id` 的地方都要停下来确认是哪个。
2. **serviceType 双重语义**：PG enum 成员名（`TRANSLATION`）用于数据库查询；中文字符串（`'翻译'`）用于 changes JSONB 历史记录和 API 显示。两者之间只有 `SERVICE_TYPE_TO_PG` / `SERVICE_TYPE_DISPLAY` 这一层翻译，不要绕过它。
3. **JSONB 字段不能用 Prisma where**：`operator->>'id'` 这类查询必须用 `$queryRaw`。这不是 Prisma bug，是设计边界。
4. **动态 import vs 静态 import**：`ServiceService.getServiceRecords` 里曾经用 `const { REGION_TO_PG } = await import(...)` 放在函数内，功能上没错但每次调用都重新解析模块。改为顶层静态 import 更规范。
5. **MongoDB $facet → Prisma**：用 `Promise.all` 分解为多个并行查询，时间序列（按月/年分组）用 `$queryRaw`，不要尝试用 Prisma groupBy 模拟复杂聚合。

### 待验证（Phase 5 启动后）
- [ ] 重启 backend 容器（DATABASE_URL 已在 docker-compose.yml 中配置）
- [ ] `GET /api/health` 返回 `postgresql: connected`
- [ ] 运行 `backend/scripts/verify-migration-complete.js`
- [ ] 端对端冒烟测试（OC 批准后）
- [ ] 合并 `feature/Task1` → `main`

---

## 当前状态（截至 2026-03-09）

- **MongoDB**：已从所有 active 代码路径移除
- **PostgreSQL**：Prisma 是唯一数据访问层
- **Phase 1–5**：全部 DONE ✅
- **待完成**：启动验证 + 合并主干

---

## 技术债 / 注意事项

1. `prisma/migrations/` root 所有权问题：将来需要新迁移文件时，必须 docker exec 操作（不能用 Write 工具）
2. `seedSimple.js` 仍用 Mongoose，但仅是 seed 工具，不影响运行时
3. `deactivateAllMyApplications` 的 shadow write 在 Phase 3 有意跳过（updateMany 路径），Phase 5 切主后已无关联（shadow 层已移除）
4. `non_project_services_dedup_active_idx` 部分唯一索引通过 DDL 手动打（不在 migration.sql），`prisma migrate reset` 后需重新执行

---

## QUESTIONS 归档（Q001–Q015，全部已关闭）

_归档时间：2026-03-09_

| ID | 标题 | 决策结论 | 关闭时间 |
|----|------|----------|----------|
| Q001 | PostgreSQL 技术栈选择 | **Prisma**（owner 批准） | 2026-03-08 |
| Q002 | Tailwind 渐进替换策略 | **渐进替换**（owner 批准） | 2026-03-08 |
| Q003 | 数据迁移停机策略 | **短停机窗口**，dry-run 后执行（owner 批准） | 2026-03-08 |
| Q004 | Phase 1 完成通知 | OC 确认验收，Phase 1 通过，进入 Phase 2 | 2026-03-08 |
| Q005 | Phase 2 Dry-Run 完成 | OC 确认验收，23/23 通过，backend 重启延至演示后 | 2026-03-08 |
| Q006 | Phase 3 Step 1+2 完成 | 合并入 Q007 | 2026-03-08 |
| Q007 | Phase 3 Step 2 完成 | OC 确认验收，15 hooks 落地，继续无风险收尾 | 2026-03-08 |
| Q008 | Phase 3 收尾交付完成 | OC 确认验收，runbook/phase5 plan/verify script 通过 | 2026-03-08 |
| Q009 | 协调配置审计完成 | 项目内无遗留临时配置，保留机制清晰 | 2026-03-08 |
| Q010 | Phase 2 Apply + Shadow Writes 上线 | OC 通过 Q011 确认，apply 完成，shadow writes 激活 | 2026-03-08 |
| Q011 | Watcher 重复触发确认 | 无新任务，继续 burn-in 监控；OC_WAKE 仅真实错误时触发 | 2026-03-09 |
| Q012 | Watcher 误触发阈值调整 | 无需调整，按 Q011 规则执行 | 2026-03-09 |
| Q013 | Phase 3 Burn-in 通过 — Phase 4 方向 | **方案 A：Tailwind 先行，PG 切主后置**（OC 签字，门控 6/6） | 2026-03-09 |
| Q014 | 联调验证回执 — 新唤醒流程测试 | 双通道流程（QUESTIONS 留痕 + 终端 OC_WAKE）验证通过 | 2026-03-09 |
| Q015 | Watcher end-to-end probe（TEST） | watcher 端到端联通验证通过 | 2026-03-09 |
