# PROJECT.md

## Project Name
Volunteer Tracker（志愿者管理系统）

## Project Type
Type A（复杂业务系统，前后端分离）

## Project Goal
本项目服务约 100 名志愿者及管理者，目标是提供稳定、可审计的志愿服务记录管理平台：支持账号体系、服务记录提交与代提、审核流转、记录修改/删除、以及后续导出与审计追踪能力。系统应优先保证流程正确性、权限边界和数据可追溯性。

## Current Phase
当前处于“核心功能基本具备 → 测试补强与架构迁移准备”阶段。代码中已存在认证、申请/审核、服务记录、审计与管理中心相关模块；现阶段优先推进两项迁移（MongoDB→PostgreSQL、样式体系→Tailwind CSS）并完成回归测试与风险控制。UI 尚未定稿，样式迁移窗口成本较低。

## Key Users
- 志愿者：关心提交便捷、记录准确、修改可追溯。
- 审核/管理角色：关心审核效率、权限正确、审计清晰。
- Owner（shuyu）：关心系统可持续迭代、迁移风险可控、产品方向不跑偏。

## Known Constraints
- 当前后端依赖 Mongoose/MongoDB（代码与 docker-compose 均指向 Mongo），数据库迁移将影响模型层、查询逻辑、脚本与容器编排。
- 当前前端主要使用 SCSS（`App.scss` + `src/styles/*.scss` + 组件级 `.scss`），迁移至 Tailwind 需规划并行期与清理策略。
- 系统已有线上地址和现存功能，迁移需可回滚、可验证，避免破坏审核与数据流。
- 本阶段优先“稳定迁移 + 测试覆盖”，不先做重 UI 设计。

## Owner's Notes
- OC 作为产品代理：低风险事项可代决，高影响/高风险事项必须升级。
- 工程协作以持续会话 + `QUESTIONS.md` 为主通道。
- 迁移期间必须明确 restore point，并保持可恢复路径。
