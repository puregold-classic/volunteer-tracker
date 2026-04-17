# API 巡览（v2.1 + v3）

> **不是完整的 reference**——完整真值源是 `backend/src/routes/*.js`。本文是导览：哪个域有哪些 endpoint、各自的语义和权限。

所有 endpoint 都挂在 `/api/v1/` 前缀下。中间件层：`authenticate` 强制 JWT，`authorizeRoles` / `authorizeReviewer` 检角色。

| 域 | mount | 文件 |
|---|---|---|
| 认证 + admin 账号管理 | `/api/v1/auth` | `routes/authRoutes.js` |
| 志愿者档案 | `/api/v1/volunteers` | `routes/volunteerRoutes.js` |
| 部门 | `/api/v1/departments` | `routes/departmentRoutes.js` |
| 服务项 | `/api/v1/service-items` | `routes/serviceItemRoutes.js` |
| 项目支援 | `/api/v1/project-supports` | `routes/projectSupportRoutes.js` |
| 项目（v3） | `/api/v1/projects` | `routes/projectRoutes.js` |
| 关注列表（v3） | `/api/v1/lists` | `routes/volunteerListRoutes.js` |
| 项目支援台账 | `/api/v1/support-ledger` | `routes/supportLedgerRoutes.js` |
| 系统设置 | `/api/v1/system-settings` | `routes/systemSettingsRoutes.js` |
| 审计日志 | `/api/v1/audit` | `routes/auditRoutes.js` |
| 数据导出 | `/api/v1/exports` | `routes/exportRoutes.js` |

---

## 1. 认证与账号 (`/auth`)

### 公开
- `POST /register` — 用户自注册（chunk 6 没在 UI 上暴露入口，留给未来）
- `POST /login` → `{token, account}`

### 已登录
- `POST /logout` — JWT 客户端清除（server side 无状态）
- `GET /me` — 当前用户信息

### admin 专属
- `GET    /admin/accounts` — 全部账号列表（含 joined volunteer）
- `PATCH  /admin/accounts/:accountId` — 改 `name / email / role / isActive`。AdminCenter 编辑对话框走这条
- `DELETE /admin/accounts/:accountId` — 删账号（同时 cascade 删 volunteer）
- `POST   /admin/volunteers` — 原子创建 volunteer + account（也 a_admin 可用）
- `POST   /admin/admins` — 创建无 volunteer 的 admin 账号
- `POST   /admin/import-volunteers` — CSV 批量导入
- `POST   /admin/reset-system` — 清空所有业务数据，仅保留当前 admin（**危险，sandbox 用**）

---

## 2. 志愿者 (`/volunteers`)

### 公开（无登录可访问）
- `GET /` — 列表 + 分页 + 过滤（`status / departmentId / region / province / search`），返回基础档案
- `GET /:idOrCode` — 单条详情
- `GET /stats` — 聚合统计：总数 / 在职 / 总时长 / 部门分布 / 区域分布
- `GET /:id/derived-stats` — 单人的派生统计

### 已登录
- `PATCH /:idOrCode` — 更新档案。AdminCenter 编辑对话框也调这条来改志愿者字段（chineseName / region / departmentId / phone 等）

> 公开 endpoint 是 chunk 6 phase B 的设计：游客可以访问 `/volunteers/:id` 看 profile（hero + 联系方式），但 records 区被 backend 401 挡掉。前端有匹配的 UI gate（"登录后可查看支援记录"）。

---

## 3. 部门 / 服务项

### 部门 (`/departments`)
- `GET /` / `GET /:id` — 公开读
- `POST` / `PATCH` / `DELETE` — admin only

### 服务项 (`/service-items`)
- `GET /` — 扁平列表
- `GET /grouped` — 按部门分组（前端 SubmitFormDialog 的 select 数据源）
- `GET /:id`
- `POST` / `PATCH` / `DELETE` — admin only

12 部门 + ~60 服务项（带 v3 的 `ServiceCategory` 枚举）是固定 reference data，由 `prisma/seed.js` 初始化。日常运行不会动这两个表。

---

## 4. 项目支援 (`/project-supports`)

### 列表 / 查询
- `GET /` — 多维过滤：`volunteerId / submittedById / serviceItemId / departmentId / status / serviceDateFrom / serviceDateTo / minDuration / maxDuration / search` + 分页
- `GET /me/pending` — **当前用户**待确认的代提交记录（用在 MePage 顶部「待你确认」section）
- `GET /:supportId` — 单条详情（`supportId` 是人类可读的 `PS-PG-0003-001`）

### 写入
- `POST   /` — 创建。`volunteerId` 不传 = 自交，传 = 代提交（自动落 `PENDING_CONFIRMATION`）
- `PATCH  /:supportId` — 修改（owner 或 admin）
- `DELETE /:supportId` — 软删，状态 → `DELETED`

### 状态机
- `POST /:supportId/confirm` — owner 确认代提交，状态 `PENDING_CONFIRMATION` → `ACTIVE`
- `POST /:supportId/reject` — owner 拒绝，状态 → `REJECTED_BY_OWNER`，可附 reason

> 业务规则全部在 `services/ProjectSupportService.js`：dedup partial unique check / 月结锁定 check / 状态转换守卫 / 自动写 AuditLog。controller 是空壳。

---

## 5. 项目支援台账 (`/support-ledger`)

只读视图，全部 b_admin / a_admin / admin 可访问（`authorizeReviewer` 中间件）。前端 ReviewPage 的全部 6 个 endpoint 都是这里的。

- `GET /overview` — KPI strip + 按部门 / 按志愿者 / 按服务项 三维度聚合
  - 接收 `dateFrom / dateTo / departmentId` 过滤参数（chunk 6 phase C.2 加的）
  - 4 个 raw query 都 honor 过滤，不只是 totals
- `GET /time-series` — 近 N 月（默认 12）按月时长趋势，给 sparkline 用
- `GET /proxy-contributions` — 代提交贡献排行榜
- `GET /recent-activity` — 最近 N 条 AuditLog（默认 50），给「最近活动」timeline
- `GET /volunteers/:volunteerId` — 单个志愿者的 drill-down 详情：summary + byServiceItem + byMonth + recentRecords + proxy 贡献次数

---

## 6. 系统设置 (`/system-settings`)

- `GET /` — 单行 settings（目前只有 `lockedBefore`）
- `POST /lock` — 月结锁定一个日期之前的所有 ProjectSupport，admin / a_admin 可用，**forward-only**

---

## 7. 审计日志 (`/audit`)

只读，admin only：

- `GET /logs` — 全部 AuditLog 列表 + 过滤
- `GET /target/:targetType/:targetId` — 某个 entity 的完整变更历史
- `GET /stats/summary` — 按 action 的统计
- `GET /:auditId` — 单条详情

> AuditLog 的 actions enum 见 `prisma/schema.prisma`：`support_create / support_update / support_delete / support_confirm / support_reject / volunteer_create / volunteer_update / volunteer_deactivate / account_create / account_update / month_lock / system_cleanup / seed_import`。每个 action 都附带 `actionDetails`（JSONB 快照）+ `changes`（field-level diff 数组）+ `operator` + `submitter`（区分代提交场景的「实际操作者」和「原提交人」）。

---

## 8. 数据导出 (`/exports`)

- `GET /supports` — ProjectSupport 列表导出 CSV / Excel
- `GET /ledger-overview` — 台账聚合导出

两个都受 `validateExportRequest` 中间件保护（参数白名单 + 速率限制）。**纯读操作**——不影响任何统计、不修改任何数据。

---

## 响应约定

成功：

```json
{
  "success": true,
  "data": { ... }
}
```

失败：

```json
{
  "success": false,
  "error": "人类可读的错误消息"
}
```

HTTP 状态码：`200` ok / `201` created / `400` 业务校验失败 / `401` 未认证 / `403` 权限不足 / `404` not found / `409` 冲突（如重复提交）/ `500` 服务器错误。

> Frontend `services/api.ts` 监听 `401` 并 dispatch `app:unauthorized` event，App.tsx 接住后跳 `/login`。
