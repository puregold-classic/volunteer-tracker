# QUESTIONS.md

_历史条目（Q001–Q015）已归档至 `memory/migration-phases.md`（2026-03-09）_

---

## [Q016] [OC_WAKE] Q013/Q014/Q011 收口完成 — Phase 4 启动就绪
**Type:** Done notification
**Priority:** Normal
**Status:** 已关闭（OC confirmed 2026-03-09T01:34:37，主链路正常）
**OC回复：** 已收到 Q016 refresh ping，主链路正常，继续待命。
**Wake channel:** terminal `[OC_WAKE] Q014/Q016 closed -> needs_reply` sent at 2026-03-09T
**Wake channel (refresh):** terminal `[OC_WAKE] Q016 refresh ping 01:34:37 -> needs_reply` sent at 2026-03-09T01:34:37

### done
- Q013 已关闭：Phase 3 burn-in 通过，OC 签字 ✅，Phase 4 方案 A 批准
- Q014 已关闭：联调验证通过，OC 回复已补充
- Q011 残留 Pending 已修正为 已关闭
- Q015 已关闭：watcher 端到端联通验证通过
- Q001–Q015 全部归档至 memory/migration-phases.md

### in-progress
- Phase 4（Tailwind 接入）：方案 A 批准，可立即启动

### risks
- 无。shadow writes 稳定运行，PG == Mongo 行数一致。

### decisions-needed
- none

---

## [Q017] [OC_WAKE] Phase 4 + Phase 5 完成 — MongoDB 完全移除，PG 成为唯一数据库
**Type:** Done notification
**Priority:** Normal
**Status:** 已关闭（OC confirmed 2026-03-09，继续收口待命）
**Wake channel:** terminal `[OC_WAKE] Q017 Phase4+Phase5 complete -> needs_reply`

### done
- **Phase 4（Tailwind CSS v4）**：完成。`@tailwindcss/vite` 插件接入，`tailwind.css` 入口文件建立，Vite config 和 main.tsx 已更新。
- **Phase 5（PG as sole DB）**：完成。所有 active 代码路径（10 个文件）从 Mongoose 切换到 Prisma：
  - ReviewService, validationUtils, ServiceService, AuditService
  - reviewController, adminController, exportController
  - ExportService, authorizeReviewer, server.js
- `seedSimple.js` 保留 Mongoose（仅 seed 工具，非 active 路径）。
- DEVLOG.md 更新（Phase 4 + Phase 5 条目）。
- DECISIONS.md 更新（D006–D009：事务、JSONB mutation、翻译层、$queryRaw）。

### in-progress
- 启动验证尚未执行（需要 OC 授权重启容器）：
  1. 重启 backend 容器（DATABASE_URL 已在 docker-compose.yml 中配置）
  2. `GET /api/health` 应返回 `postgresql: connected`
  3. 运行 `backend/scripts/verify-migration-complete.js`

### risks
- `seedSimple.js` 仍依赖 Mongoose，但它不在任何服务路径上，不影响运行时。
- 未验证过的路径：admin routes（adminController 的 route 文件尚未读取，建议 OC 授权后跑一次端对端冒烟测试）。

### decisions-needed
- OC 是否批准重启 backend 容器进行启动验证？
- Phase 5 完成后是否合并 `feature/Task1` → `main`？

---

## [Q018] [OC_WAKE] Frontend UI sprint 收口 — 首页/移动端/地图交互修复完成
**Type:** Done notification
**Priority:** Normal
**Status:** Pending

### done
- 完成多轮前端 UI 升级：统一 primitives、首页/卡片/详情页重构、Header/Footer/Login/Me/Review 持续优化
- 完成移动端首页结构切换：搜索/筛选入口 + 地图/列表 tab + bottom sheet
- 完成移动端触控区修正：Button/Input/Select 可用性提升
- 修复 `Select` 兼容性问题，避免页面运行时报错
- 修复地图快速聚焦地区（美国/欧洲等）点击报错：
  - 地图浮层按钮事件 stopPropagation
  - 区域级名称不再进入省份筛选链路
- 最近一轮修改后，`frontend/npm run build` 通过

### in-progress
- Playwright E2E 目前只有 3 条骨架脚本，尚未稳定化/接入 CI
- 首页和 Review 还可以继续做密度与信息层级优化，但不阻塞当前使用

### risks
- 当前未发现阻塞性问题
- 剩余风险以体验细节为主，不是功能中断级别

### decisions-needed
- none
