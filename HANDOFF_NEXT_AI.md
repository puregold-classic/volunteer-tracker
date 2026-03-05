# 项目状态文档（AI 接班用）

> 最后更新：2026-03-04，由 OpenClaw AI 重新探索整理。

---

## 项目概览

**全球志愿者可视化与管理平台**，前后端分离架构，已部署生产环境。

- **前端（Netlify）：** https://pgc-volunteer.netlify.app/
- **后端（Render）：** https://volunteer-tracker.onrender.com/
- **本地开发：** 前端 http://localhost:3000 / 后端 http://localhost:5000

---

## 技术栈（当前实际）

| 层 | 技术 |
|----|------|
| 前端 | React 18 + TypeScript + Vite 7 + SCSS + react-leaflet |
| 后端 | Node.js + Express（ESM）|
| 数据库 | MongoDB + Mongoose |
| 认证 | JWT（bcryptjs）|
| 导出 | csv-writer + exceljs + jszip |
| 部署 | Netlify（前端）+ Render（后端）+ MongoDB Atlas |

---

## 权限体系（当前实现）

| role | 说明 |
|------|------|
| `user` | 普通志愿者，可提交 NPS 申请 |
| `b_admin` | 审核员（部长），可审核申请 |
| `a_admin` | 高级管理员，含审核员权限 |
| `admin` | 开发者，进入 AdminCenter（账号管理） |

前端判断：`isReviewer = ['b_admin', 'a_admin', 'admin'].includes(role)`，`isSystemAdmin = role === 'admin'`。

---

## 当前已实现功能

### 后端 API 路由
- `GET/POST /api/v1/volunteers` — 志愿者列表、搜索、筛选、分页、统计
- `GET /api/v1/volunteers/:id` — 单个志愿者详情
- `GET /api/v1/services` — NPS 服务记录
- `GET /api/v1/services/export` — 导出（CSV/Excel）
- `POST /api/v1/applications` — 提交 NPS 申请（create/update/delete）
- `GET/POST /api/v1/reviews` — 待审/已处理申请，审核操作
- `GET /api/v1/audit` — 审计日志
- `POST /api/v1/auth/login|register|logout` + `GET /api/v1/auth/me|accounts`

### 前端页面
- **首页（home）：** 地图（react-leaflet）+ 右侧志愿者列表，支持：
  - 状态筛选（在职/不在职）
  - 方向筛选（翻译/校对/管理/技术）
  - 热门省份快捷（北京/上海/深圳）
  - 地区/省份多选或单选
  - 地图点击省份联动
  - 实时搜索（250ms debounce）
  - 顶部 summary 统计（总数/在职占比/服务时长）
- **个人中心（me）：**
  - 普通用户：账号信息 + 志愿者档案 + NPS 记录（分页）+ 提交/修改/删除 NPS 申请
  - admin 用户：AdminCenter（账号管理、批量导入、重置系统）
- **审核中心（review）：**
  - 待审申请列表 + 图表（按 serviceType / volunteerId 可视化）
  - 已处理历史
  - 单条审核（通过/拒绝）+ 批量审核
  - 图表模式切换：Create / Change / Delete
- **志愿者详情弹窗（VolunteerDetailModal）：**
  - 志愿者档案 + NPS 记录（分页）
  - 提交 NPS 申请入口（需登录）

### 数据模型
- `Volunteer` — id（PG-xxxx）/ chineseName / englishName / status / region / province / services[]
- `Account` — email / passwordHash / name / role / volunteerId / isActive
- `NonProjectService` — serviceId / volunteerId / serviceType / duration / serviceDate / description / isActive
- `ServiceApplication` — applicationId / applicationType / volunteerId / changes[] / submittedBy / status / reviewNote
- `AuditLog` — 操作审计

### 服务类型（当前有效）
`翻译 / 校对 / 管理 / 技术`（旧类型已迁移清理）

---

## 开发账号（本地 seed 数据）

| 邮箱 | 密码 | role | volunteerId |
|------|------|------|-------------|
| admin@example.com | Admin@12345 | admin | PG-0000 |
| reviewer@example.com | Reviewer@123 | a_admin | PG-9999 |
| （志愿者账号）| Volunteer@123 | user | PG-xxxx |

---

## 常用命令

```bash
make dev                              # 启动前后端开发服务
make seed-quality                     # 种子数据（质量数据集）
make seed-admin                       # 创建 admin 账号
make migrate-data                     # 运行所有迁移
make migrate-remove-deprecated-services  # 清理废弃服务类型
make backfill-accounts                # 补全账号-志愿者关联
make migrate-reviewer-ids             # 迁移审核员 ID
make recover                          # Docker 恢复
```

---

## 已知问题 / 注意事项

1. **NPS 申请 submitter ID** 必须是 `PG-xxxx` 格式。admin 回退到 `PG-0000`，无 volunteerId 的普通用户会被前端 block。
2. **isActive 字段**：旧迁移脚本将废弃类型的 NPS 记录设为 inactive，若用户反馈"记录消失"，先检查 `isActive`。
3. **App.tsx 较大**：所有 state 和逻辑目前在 App.tsx 中，通过 `useAdminCenter` / `useReviewCenter` / `useMeCenter` 三个自定义 hook 分离了部分逻辑。
4. **无路由系统**：志愿者详情页是弹窗（modal），无 URL，不可直接分享链接。

---

## 下一步建议（待 Shuyu 确认优先级）

1. **"我的申请记录"**：个人中心增加 pending/approved/rejected/withdrawn 申请历史视图
2. **志愿者详情路由化**：`/volunteers/:id` 独立页面，取代或补充弹窗
3. **废弃 NPS 记录处理**：决定是保持 inactive 还是重新映射到现有类型
4. **前端拆分**：App.tsx 过大，可继续模块化
5. **自动化测试**：目前无前端测试覆盖
