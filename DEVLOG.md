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
