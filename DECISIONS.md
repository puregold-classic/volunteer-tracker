# DECISIONS.md

## D001 - Migration Strategy Baseline (2026-03-08)

### Decision
采用“先设计与并行验证，再切换”的迁移策略，而非一次性重写：
- DB: MongoDB -> PostgreSQL 分阶段推进
- CSS: SCSS -> Tailwind 渐进替换

### Why
- 当前系统已有可用核心功能，直接大爆炸迁移风险高。
- 数据模型复杂（Account/Volunteer/ServiceApplication/NonProjectService/AuditLog），需先做 schema mapping 与数据一致性验证。
- UI 尚未定稿，Tailwind 在此时接入成本较低，适合与功能回归并行推进。

### Consequences
- 前期会多出设计与验证成本，但可显著降低回滚与线上风险。
- 短期内会存在双体系（Mongo/PG 准备期、SCSS/Tailwind 过渡期），需维护清晰边界。

### Next Technical Decisions Needed
- ~~ORM/Query 方案（Prisma / Knex / TypeORM / 原生 pg）~~ → **Prisma（已确认）**
- ~~ID 与约束映射策略~~ → **cuid() for PG surrogate ID, domain ID (volunteerId etc.) retained as unique strings**
- 数据迁移工具链与校验口径
- Tailwind 设计 token 与组件迁移顺序

---

## D002 - Partial Unique Index Applied via DDL, Not Migration File (2026-03-08)

### Decision
`non_project_services_dedup_active_idx`（WHERE isActive=true 的部分唯一索引）通过直接 `psql` DDL 应用，而非写入 Prisma migration.sql 文件。

### Why
- 迁移文件目录由 Docker volume 挂载时以 root 创建，当前用户无写权限。
- Prisma 已将第二条迁移标记为 applied（内容为空注释），重新修改会导致 checksum 不一致，破坏迁移状态。
- 直接 DDL 是此场景的最简安全路径，索引已验证存在于 `pg_indexes`。

### Consequences
- 索引存在于数据库但不在 migration.sql 中，未来 `prisma migrate reset` 会丢失该索引。
- 若需要回滚后重建 schema，需手动重新执行该 DDL（已记录在 DEVLOG.md）。
- 生产环境正式部署前，应将该 DDL 合并进一个新的 Prisma migration 以保持一致性。

---

## D004 - Phase 2 Mapping Decisions (2026-03-08)

### Decision
以下 mapping 策略在 dry-run 验证通过后固定：

1. **Volunteer domain ID**: Mongo `id` 字段（`PG-0001`）→ PG `volunteerId` 唯一字符串。PG surrogate PK 用 `randomUUID()` 生成。
2. **Indexed mirror fields**: Mongo 的 `indexedStatus`, `indexedVolunteerId`, `indexedRegion` 等镜像字段全部丢弃 — PG 原生索引覆盖同等查询需求。
3. **Embedded objects → JSONB**: `changes`, `submittedBy`, `actionDetails`, `operator`, `submitter`, `auditHistory` 以 JSONB 存储，保留完整结构，无需 normalize（Phase 1 设计已确认）。
4. **AuditLog timestamp**: Mongo 使用 `timestamps: { createdAt: 'timestamp' }`，PG 有独立 `timestamp` 字段，直接映射。
5. **AuditLog.actionDetails.applicationType**: 含 `'system'` 值，不在 PG ApplicationType 枚举中，但 actionDetails 是 JSONB，无约束，可以存储任意值 — 不需要修正。
6. **PK generator**: `crypto.randomUUID()`（Node 18 built-in），替代 `@paralleldrive/cuid2`（未安装）。apply 模式写入 PG 时一致使用。

### Why
- Volunteer `id` 混用（Mongo 文档的 domain ID 存在 `id` 字段而非 `_id`）是历史遗留设计，这里 explicit mapping 防止混淆。
- 镜像字段是 Mongo 的查询优化手段，PG 有更优雅的索引机制，保留无意义且浪费空间。
- JSONB 而非 normalize 是 Phase 1 的设计决定，dry-run 验证数据完整性后继续沿用。

---

## D005 - Phase 3 Parallel Adapter Architecture (2026-03-08)

### Decision
使用"并行适配器 + shadow write"模式，Mongoose 保持 source of truth，Prisma 层只做 shadow 写入。

### Pattern
1. Mongoose write（阻塞，source of truth）→ 成功后
2. `pgShadow.write(model, doc)`（fire-and-forget，never throws）→ 写入 PG

### Key constraints
- PG 写入失败不影响 HTTP 响应
- Shadow 使用 upsert（幂等），可重复执行不产生重复数据
- `PG_SHADOW_WRITE=false`（默认）时全部 shadow 逻辑短路，零开销
- Prisma client 懒加载，`DATABASE_URL` 缺失时静默 no-op，不影响 server 启动

### Hook scope (Phase 3 Step 1)
仅 ReviewService 无事务路径（开发环境实际执行路径）：
- `serviceRecord.save()` → `pgShadow.nonProjectService`
- `application.save()` → `pgShadow.serviceApplication`
- `auditLog.save()` → `pgShadow.auditLog`

### Why not "big bang" cutover
- 当前有线上运行的演示数据，大爆炸切换风险过高
- 并行适配器允许逐路由验证，出问题可 per-flag 回滚
- 演示前不重启 backend，shadow 功能在演示后才实际触发

### Rollback
`PG_SHADOW_WRITE=false` 即可回滚到 MongoDB-only 状态，无需改代码。
完全代码回滚：`git checkout 734ba97 -- backend/src/services/ReviewService.js`

---

## D006 - Phase 5: Prisma $transaction Replaces MongoDB Sessions (2026-03-09)

### Decision
所有需要原子性的多步操作改用 `prisma.$transaction(async (tx) => {...})`，移除 MongoDB session 相关逻辑。

### Why
- Prisma 的事务 API 与 MongoDB session 语义等价，且更简洁。
- 原有代码有 `isTransactionUnsupported` fallback 路径（开发环境 MongoDB 单实例不支持事务），PG 原生支持事务，该 fallback 无意义，直接删除。

### Consequences
- 数据一致性保证比 MongoDB 路径更强（PG ACID）。
- 所有事务操作的错误处理统一为 catch + rethrow，Prisma 会自动 rollback。

---

## D007 - Phase 5: JSONB Array Mutation Pattern (2026-03-09)

### Decision
对 `auditHistory`（NonProjectService 的 JSONB 数组字段）的追加操作采用 "fetch-then-update" 模式，在事务内完成。

### Pattern
```javascript
const current = Array.isArray(record.auditHistory) ? record.auditHistory : [];
const updated = [...current, newEntry];
await tx.nonProjectService.update({ where: { serviceId }, data: { auditHistory: updated } });
```

### Why
- Prisma 不支持 PostgreSQL 的 `array_append` 或 `||` JSONB 操作符作为 Prisma 查询。
- 事务内 fetch → JS 操作 → update 保证原子性，无并发写冲突风险（业务场景下单条记录的审核写入不会并发）。

---

## D008 - Phase 5: serviceType Chinese↔PG Enum Translation Layer (2026-03-09)

### Decision
`SERVICE_TYPE_TO_PG` / `SERVICE_TYPE_DISPLAY` 双向映射表作为中文 API 输入与 PG enum 成员之间的唯一翻译层。

### Why
- Prisma schema 用 `@map()` 将 PG enum 成员（如 `TRANSLATION`）映射到中文存储值（`'翻译'`），但 Prisma 客户端使用的是成员名称（`TRANSLATION`）。
- API 层接收中文输入（前端/历史数据兼容），必须在写入 PG 前翻译。
- changes JSONB 内存储中文字符串（审核记录历史），读取时不翻译，保留原始审核上下文。

---

## D009 - Phase 5: $queryRaw for JSONB Field Filtering (2026-03-09)

### Decision
JSONB 嵌套字段过滤（如 `operator->>'id'`、`submitter->>'id'`）使用 `prisma.$queryRaw` 原生 SQL，不尝试用 Prisma where 子句实现。

### Why
- Prisma 不原生支持 JSONB 箭头操作符（`->>`）在 where 子句中的使用。
- `$queryRaw` 是 Prisma 的官方原生查询入口，安全（使用 tagged template 参数化），性能等同原生 SQL。

### Scope
- `AuditService.getOperatorAuditStatistics`: `WHERE operator->>'id' = ${operatorId}`
- `adminController.deleteAccount`: `DELETE FROM audit_logs WHERE operator->>'id' = ${volunteerId} OR submitter->>'id' = ${volunteerId}`
- 时间序列分组查询（`DATE_TRUNC`, `TO_CHAR`, `EXTRACT`）均用 `$queryRaw`。

---

## D010 - Frontend UI Refactor Uses Compatibility-First Primitives (2026-03-12)

### Decision
前端 UI 升级过程中，primitives 必须优先兼容现有调用方式，而不是强推新 API。

### Why
- 这轮 `Select` 曾被改成 `options` 风格，但现有页面大量使用 `<Select><option /></Select>`。
- Vite dev/build 不一定先暴露出所有 TS 层问题，结果会变成运行时白屏或页面打不开。
- 对现有系统做渐进升级时，兼容旧调用方式的成本远低于全量回改页面。

### Consequences
- primitives 的演进速度会慢一点，但换来更低回归风险。
- 如果未来要切新 API，应该先双栈兼容，再逐页迁移，最后删旧接口。

---

## D011 - Mobile Home Uses Alternate Information Flow, Not Desktop Shrink (2026-03-12)

### Decision
移动端首页采用“搜索/筛选入口 + 地图/列表 tab + bottom sheet”的交替式信息流，而不是简单缩放桌面双栏布局。

### Why
- 桌面首页核心是大地图 + 右侧边栏；直接缩放到手机上会导致地图、筛选、列表同时拥挤，失去优先级。
- 用户在手机上更适合一次只处理一个主任务：看地图，或看列表，再用 bottom sheet 承接详情预览。

### Consequences
- HomePage 在 mobile / tablet / desktop 三档上将继续保留差异化结构。
- 后续新增首页模块时，必须先考虑移动端的信息流，不再默认“桌面优先复制”。

---

## D012 - Region-Level Map Actions Must Never Enter Province Selection Path (2026-03-12)

### Decision
地图上的区域级操作（中国大陆 / 中国台湾 / 东南亚 / 美国 / 欧洲）与省份点击是两条完全不同的交互链。区域名绝不能进入 `toggleProvince` / `onProvinceSelect` 的省份筛选路径。

### Why
- 用户反馈点击美国/欧洲报错，本质是区域级动作误入了省份链路。
- 区域没有对应的中国省份 GeoJSON 数据，继续走 province filter 会产生错误状态或异常。
- 地图浮层按钮又和 Leaflet 容器重叠，事件更容易串线。

### Consequences
- 需要双层防御：
  1. 地图浮层按钮 stopPropagation，避免事件打到底层地图
  2. `toggleProvince` 和 GeoJSON click handler 都要过滤区域级名称
- 后续如果再加新的区域（例如加拿大/澳洲），也必须先注册为 region-level action，而不是复用 province path。

---

## D003 - Phase 1 Backend Container Not Restarted (2026-03-08)

### Decision
Phase 1 完成后不重启 backend 容器，不为 Prisma 注入 DATABASE_URL。

### Why
- Backend 目前完全依赖 Mongoose/MongoDB，重启有轻微风险（容器启动期间短暂不可用）。
- Phase 1 是纯基础设施阶段，不需要 backend 进程访问 PG。
- 晚间演示以 MongoDB 路径为准，PG 只是并行运行的新基础设施。
- DATABASE_URL 会在 Phase 3（数据访问层切换）时正式接入。
