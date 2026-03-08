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
- ORM/Query 方案（Prisma / Knex / TypeORM / 原生 pg）
- ID 与约束映射策略
- 数据迁移工具链与校验口径
- Tailwind 设计 token 与组件迁移顺序
