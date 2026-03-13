# PROJECT.md

## Project Name
Volunteer Tracker（志愿者管理系统）

## Project Goal
服务约 100 名志愿者及管理者，提供稳定、可审计的志愿服务记录管理平台。支持多角色账号体系、服务记录提交与代提、审核流转、修改/删除、导出与审计追踪。

## Current Phase
**UI 设计与打磨，准备上线。**

核心功能已完成，两项大迁移均已落地：
- ✅ MongoDB → PostgreSQL（Prisma ORM）
- ✅ SCSS → Tailwind CSS（保留少量组件级 SCSS）

当前重点：UI 细节优化，然后部署到 Mac Mini（Cloudflare Tunnel）。

## Tech Stack
- **前端：** React 18 + TypeScript + Vite + Tailwind CSS
- **后端：** Node.js + Express + Prisma ORM
- **数据库：** PostgreSQL 16（Docker）
- **部署：** Docker Compose + Cloudflare Tunnel（目标：Mac Mini；当前：WSL 测试）

## Key Users
- **志愿者：** 提交便捷、记录准确、修改可追溯
- **审核/管理角色：** 审核效率、权限正确、审计清晰
- **Owner（shuyu）：** 系统稳定可迭代，不跑偏产品方向

## Git Workflow
- 主分支：`develop`（日常集成）→ `main`（稳定发布）
- 功能开发：从 `develop` 切出 `feature/<name>`，完成后 PR 合并回 `develop`
- 直接 push 到 `develop` 或 `main` 需谨慎

## Owner's Notes
- Coordinator（OC）作为产品代理：低风险可代决，高影响必须升级
- Claude Executor 负责代码实现，通过 feature 分支工作，不直接提交到 develop
- 协作留痕：`QUESTIONS.md` 记录决策与问题，`DEVLOG.md` 记录执行过程
