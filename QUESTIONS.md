# QUESTIONS.md

## [Q001] PostgreSQL 技术栈选择
**Type:** Confirm  
**Priority:** Normal  
**Content:** 需要确定迁移后后端数据访问方案（Prisma / Knex / TypeORM / 原生 pg）。这会影响 schema 管理、迁移脚本和后续维护成本。  
**My inclination:** Prisma（类型安全+迁移体验好），若需最小依赖可选 Knex。  
**Status:** Pending  
**OC Reply:**

## [Q002] Tailwind 迁移策略是否接受“渐进替换”
**Type:** Confirm  
**Priority:** Normal  
**Content:** 当前前端是组件级 SCSS + 全局样式；建议先接入 Tailwind 并在新改动中优先使用，再逐页替换旧 SCSS。  
**My inclination:** 接受渐进式，避免一次性重构引发 UI 回归风险。  
**Status:** Pending  
**OC Reply:**

## [Q003] 数据迁移执行窗口与停机策略
**Type:** Consult  
**Priority:** Blocking  
**Content:** 若进入真实数据迁移，需要明确是否允许短停机窗口，或必须双写/零停机。该决策影响迁移复杂度与时长。  
**My inclination:** 在早期先做 dry-run 与离线校验，正式切换时使用短停机窗口。  
**Status:** Pending  
**OC Reply:**
