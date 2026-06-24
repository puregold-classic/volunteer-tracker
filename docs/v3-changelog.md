# v3 Changelog — as shipped

这份文档是 v3.1 / v3.2 / v3.3 **敲定之后的真实状态**。原版 brainstorm
（早期 `v3-plan.md` / `v3_2-plan.md`）作为讨论痕迹归档在 `archive/` 下，
和最终落地的内容有出入；以本文为准。

> **版本定义**：v3 是 v2.1 之后的数据/产品大升级。v3.1 是第一次 wave（部门重组 +
> 项目级 + 我的关注），v3.2 引入 tag 系统并彻底淘汰 Project 概念的初稿，v3.3 把
> Project 完全 drop 并统一登录标识。

---

## v3.1 — 部门重组 + 项目级批量录入 + 我的关注（2026-04-17 落地）

### 目的

- 确定 12 个部门 + 每部门的 service item 清单
- 分"项目管理 / 项目培训 / 项目支持 / 受训考勤"四大板块（`ServiceCategory`）
- 引入"项目级批量录入"填补**受训考勤不允许个人提交**这个空缺
- 加"我的关注"志愿者列表，方便管理者追踪

### 最终决策（对 v3-plan 的修订）

| 原 plan 的想法 | 最终落地 |
|---|---|
| 受训分 XZT 笔记 / 笔译培训内容 / 口译培训内容 等 attribute（用标签？） | v3.1 不做细粒度；attribute 字段留空，这些属性延后到 v3.2 用 TagGroup 解决 |
| 代提交 admin_a/b 直接=本人提交不走 confirm | 拆成 `forceActive` 参数（默认仍走 confirm），admin role 才有显式 opt-in |
| 项目级 tag 以标签形式呈现 | 只做 Project 1:1 关联，tag 体系推到 v3.2 |
| "玄奘塔"叫 `玄奘塔` | id 用 `XZT`，显示名保留 |

### 落地清单

- **schema**（`20260417120000_service_category` + `20260417170000_add_project` + `20260417200000_add_volunteer_lists`）
  - `ServiceCategory` enum：`PROJECT_MGMT` / `PROJECT_TRAINING` / `PROJECT_SUPPORT` / `TRAINING_ATTENDANCE`
  - `ServiceItem.category` 字段（FK 反射到 enum）
  - 新 `Project` 模型：`name / departmentId / sessionDate / sessionDuration / attributes JSONB`
  - 新 `VolunteerList` + `VolunteerListMember` 组合
  - `Department` 扩到 12 个：新增 `READING_CLUB` / `VIDEO` / `NET_TECH`
- **后端**：`ProjectService` + `BatchAttendance` flow，`VolunteerListService`，`TRAINING_ATTENDANCE` 分类在 ProjectSupportService.create 被硬阻止（个人提交时 400）
- **前端**：
  - `/projects` 页（admin + a_admin+ 可见）——CRUD project + 批量考勤录入（粘贴名单 → name-match preview → 落 PS）
  - 首页 / `/me` 的"我的关注" section + 心形 toggle
  - 台账页三级 drill-down（板块 → 部门 → 志愿者 → 具体条目）

### 未落项

- 地区热力图视图切换 → 搁置（当前的分布图够用）

---

## v3.2 — Tag 系统 + 账户自服务（2026-04-18 落地）

### 目的

- 用 TagGroup + Tag 替代 Project 概念的"分类"职责
- 完成账户自服务：user 改密 + 头像上传 + admin 重置他人密码
- 视频部细化、笔译项目加"文稿整理"、新增"网络技术部"

### 最终决策（对 v3_2-plan 的修订）

原 plan 的设想是"项目级 tag 化"——把某些下拉选项（项目方 / 岗位）放进 tag 系统，
但 **Project 继续存在**。经过 session 里多轮讨论，**放弃这个折衷方案**，改成：

| 原 plan 想法 | 最终落地 |
|---|---|
| Project + 点击弹窗选岗位 / 项目方 tag | `Project` 不再挂标签——所有标签走新 TagGroup 体系，`ServiceItem` 绑定 TagGroup 触发弹窗 |
| "弹窗选择"只在 笔译/口译执行 service item 时 | 通用化——任何 ServiceItem 可以被任意数量的 TagGroup `boundServiceItemIds` 引用 |
| 标签是单选 | **3 轴设计**：`selectionMode`（single/multi）× `opMode`（managed/tag_only）× `openness`（closed/open）+ `required`。4 种 use case 一次覆盖 |
| 批量改动都走 admin | 改名、建 tag、批量增删改 = a_admin+；建组 = admin |
| 管理员不能删密码不对的用户密码 | admin 可在 AdminCenter 按账号走 prompt-driven reset，改密后自动 bump `tokenValidAfter` 把对方所有会话踢下线 |

### 落地清单

- **schema**（`20260419120000_v3_2_tag_system`）
  - `TagSelectionMode` / `TagOpMode` / `TagOpenness` enum
  - `TagGroup`（name unique + 3 轴 + `boundServiceItemIds[]` + `required`）
  - `Tag`（group-scoped unique name）
  - `TagAttachment`（M:N Tag↔ProjectSupport）
  - `AuditAction` 扩展 `tag_create` / `tag_update` / `tag_delete` / `tag_attach` / `tag_detach` / `support_batch_*` / `account_password_change` / `account_password_reset` / `account_avatar_update`
- **后端**
  - `TagGroupService` + `TagService`（attach/detach + 5 batch ops + name-match 名单解析）
  - 路由：`/tag-groups` (admin-only CRUD) + `/tags` (a_admin+ CRUD + batch)
  - `AuthService` 加 `changePassword / adminResetPassword / updateAvatar`
  - 路由：`/auth/change-password`、`/auth/me/avatar`、`/auth/admin/accounts/:id/reset-password`
- **前端**
  - 新 `/tags` 页（admin + a_admin+）——组 + tag 树 + tag 详情面板
  - `SubmitFormDialog` 选 service item 时自动弹出所有绑定的 TagGroup 作 inline picker
  - `SupportRecordCard` 展示附加的 tags
  - `AccountSettingsDialog`（头像 tab 走 canvas resize 到 ≤512px jpeg，改密 tab 成功后自动 logout）
  - AdminCenter 每行加 KeyRound 重置密码按钮

### 4 个种子 TagGroup

| 组 | 3 轴 | bound | tags |
|---|---|---|---|
| 项目方 | single / tag_only / closed | 笔译执行 + 口译执行 | ACI / DCI / DSEU / IR / PG / XZT / YSI |
| 笔译岗位 | single / tag_only / closed / required | 笔译执行 | 初翻 / 一校 / 二校 / 终校 / 终审质检 |
| 口译岗位 | single / tag_only / closed / required | 口译执行 | A岗 / B岗 |
| 培训（v3.3 重命名） | multi / managed / open | TRAINING_ATTENDANCE 类全部 | runtime 添加 |

---

## v3.3 — 彻底清 Project + 三合一登录（2026-04-18 落地）

### 目的

v3.2 保留 Project 是为了向前兼容，但 session 中发现：
- `/projects` 页 UX 和 `/tags` 功能重合，两套并存让用户困惑
- `ProjectSupport.projectId` 单一 FK 限制了"一条 PS 挂多个维度"的灵活性
- SupportRecordCard 的 `link-project` 按钮语义错位

本版激进地**完全 drop Project**，批量 + 挂接 + 关联全部走 tag 单一路径。
顺手把登录升级成 email / 手机号 / 志愿者 ID 三合一单字段。

### 敲定过程中的关键讨论点

1. **Project drop 节奏**：激进 vs 保守保留一版
   - 用户："全面迁移为 tag 功能" + 本地 + sandbox 都无生产数据
   - 决策：**激进**——v3.3 直接 drop schema + 删所有相关代码
2. **`会话` 组的命名**：保留中性名 / 改成 `培训` / admin 按需自建 managed 组
   - 决策：**改 `培训`** + 说明"非培训批量场景 admin 再建新组"
3. **培训组的 serviceItem 绑定**：绑死 / 按 category / 完全自由
   - 决策：**按 category**（TRAINING_ATTENDANCE 类全部绑进来），每次批量建 PS 时从 5 个里选具体哪节课
4. **三种登录标识共存**：双字段切换 / 单字段自动识别
   - 决策：**单字段**，content-based 识别（`@` → email / 数字 → 手机号 / 字母-数字 → 志愿者 ID）
5. **Admin 要不要也能手机号登**：要 vs 不要
   - 决策：**不要**——admin role 没绑 volunteer，phone 存在 Volunteer 侧；admin 只能 email 登
6. **phone 加 `@unique` 约束**：硬约束 vs 登录时软处理
   - 决策：**硬约束**——Volunteer.phone `@unique`，空串写入前转 NULL，避免大量"空字符串"互相冲突

### 落地清单

- **schema**（`20260420000000_drop_project` + `20260420100000_volunteer_phone_unique`）
  - DROP `projects` 表 + `project_supports.projectId` 字段 + FK 约束 + index
  - `Volunteer.phone String? @unique`
  - `Volunteer.createdProjects` + `Department.projects` relation 删除；`ProjectSupport.projectId` / `project` 字段删除
  - `AuditTargetType.Project` enum **保留**（给历史 audit_log 行使用）
- **后端删**：`ProjectService` / `projectController` / `projectRoutes` / `ProjectService.test.js` / server.js 里的 `/api/v1/projects` mount / serializer 里的 `serializeProject` / IDGenerator 里的 `generateProjectCode`
- **后端新**：`utils/identifierUtils.js`（`normalizePhone` + `detectIdentifierKind`）
- **后端改**：
  - `AuthService.login` 接受 `identifier`（新）+ `email`（旧，BC），按内容分三路查
  - `AccountService` / `VolunteerService` 存 phone 前走 `normalizePhone`
  - `TagService.listSupports` 输出过 `serializeProjectSupport`（修 dept-name 扁平化 bug）
- **前端删**：`ProjectsPage` / `projectService` / `link-project-dialog`
- **前端新**：
  - `link-tags-dialog`（PS 事后改标签——对已挂 tag 和当前选择做 diff，attach/detach）
  - `TagsPage` 右面板补 3 个 dialog：
    - **BatchUpdateDialog**（managed 组）——dry-run preview 显示影响条数 + 原时长分布，应用按钮必须预览过才能点
    - **ManualAttachDialog**（所有组）——志愿者 typeahead + 他的 PS 列表（按 boundServiceItemIds 过滤）+ 勾选 batch attach
    - 每个 member 行：`MinusCircle` icon 一键 detach
  - `/tags` 导航替代 `/projects`
  - `LoginPage` label 改 "邮箱 / 手机号 / 志愿者 ID"，单字段 input
  - `AccountSettingsDialog` 头像 preview 走 HeroAvatar 的 `avatarUrl` 分支

### 命名归一（和 v3.2 原 plan 不一致的地方）

| 原 v3.2 plan 词 | v3.3 真实词 |
|---|---|
| 会话组 / session group | **培训组** |
| link-project | link-tags |
| project-level 批量录入 | 粘名单建 PS（挂在 tag 上） |
| session-style 自由标签 | "可批量录入 PS 的 tag 组" |

---

## v3.5 — 部门三大组 reorg + tag 软删修复（2026-06-24 落地）

### 目的

把部门按**三大组**重新组织，组边界对齐已有的三个主 `ServiceCategory`
（翻译项目→`PROJECT_MGMT` / 组织培训→`PROJECT_TRAINING` / 项目支援→`PROJECT_SUPPORT`，
受训/`TRAINING_ATTENDANCE` 为横跨第 4 类）。不引入新 schema 概念，纯参考数据（seed）调整。

### 部门变化（12 → 15）

id code 全部保持稳定（历史 FK / 记录不破），只改显示名 + 重排 displayOrder：

| 组 | 部门（id） | 变化 |
|---|---|---|
| 翻译项目 | 口译项目管理(KY_PROJECT) / 笔译项目管理(BY_PROJECT) / **特殊项目管理部(SPECIAL_PROJECT, 新)** / XZT项目管理部(XZT) | 改名 + 1 新 |
| 组织培训 | 口译培训(KY_TRAINING) / 笔译培训(BY_TRAINING) / **笔译考核(BY_EXAM, 新)** / 共读会(READING_CLUB) | 改名 + 1 新 |
| 项目支援 | 支援管理部(MGMT←管理部) / 技术部(TECH) / 推广部(PROMO) / 人文关怀部(CARE←人文部) / 视频部(VIDEO) / 文档管理部(DOCS←文档部) / 网络技术部(NET_TECH) | 改名；NET_TECH 纳入统管 |

### service / tag 变化

- `特殊项目管理部`：服务统计 / 沟通反馈 / 管理策划 / **特殊项目执行**（仿笔译口译，PROJECT_MGMT）
- `笔译考核`：考题设计 / 组织考试 / 改卷点评（PROJECT_TRAINING）
- `人文关怀部` 加 **片区管理**（五大区域群，PROJECT_SUPPORT）
- `文档管理部`：国宝录入 → **国宝表格录入**（rename；旧项 orphan sweep 软停留作审计）
- tag 组「培训」→ **「受训」**（受训考勤维度，带一次性 rename 迁移）
- 新 tag 组 **「培训项目」**：初翻培训 / 校对培训 / 雪山流项目培训（组织培训维度，绑 笔译培训.项目执行；与受训正交）

### bug 修复

- **tag 软删后成员名不消失**：`全部软删`(batchDelete) 只把 PS 置 `status=DELETED`，保留
  TagAttachment 行；而 `TagService.listSupports` 按 tagId 查 attachment **没过 status**，
  所以软删成员仍显示。修：listSupports 加 `support: { status: 'ACTIVE' }` 过滤（attachment
  保留，PS 恢复后重新出现，软删仍可恢复）。补 `TagService.test.js` 回归。

### 落地清单

- **seed**（`backend/prisma/seed.js`）：DEPARTMENTS 15 个 + SERVICE_ITEMS + TAG_GROUPS 调整；
  `seedDepartments` 加 displayOrder park-then-set（避免 `@unique` 重排瞬时冲突）；
  seedTagGroups 加 `培训→受训` 一次性 rename。**无 schema migration**——纯 seed 数据，重跑 `make seed` 生效。
- **前端**：`HomePage.tsx` 部门 filter 列表、`ledger-colors.ts` `DEPT_COLOR`（补到 15 + 分色系）、`types.ts` 注释
- **后端**：`TagService.listSupports` 过滤 + 新 `TagService.test.js`

### 待办（本版未做）

- **志愿者 ID 改生日制**：`volunteerCode` 从自增 `PG-NNNN` 改成「生日 5 位、末位 a/b/c/d 去重」
  （如 `0305a`）。涉及 IDGenerator + supportId 格式（`PS-{code}-NNN`）+ 校验正则 + admin 建档表单手动录入 + CSV import，
  与"人员录入"耦合，单独一版做。

---

## 当前部署状态（2026-04-18）

| 环境 | Branch | HEAD | 备注 |
|---|---|---|---|
| 本地 dev（WSL + Docker） | develop | 2a5c37a | 全功能跑通 |
| Mac mini sandbox | develop | 2a5c37a | https://dev.puregoldclassictranslation.com |
| 生产 | — | — | 未上 |

### 登录凭证（sandbox）

- Admin：`admin@puregoldclassictranslation.com` / `q4m2GlqtriDp0cglzGqa`
- 样例志愿者：`PG-0001` … `PG-0004` / `Sample@123`（也可用手机号登，但 seed 没给 phone，需 admin 手动补）

### 测试覆盖

- 后端：`make test` — 120 tests（v3.2 后 +14 = v3.3；identifierUtils 7 + AuthService 新路径 4 + 其他 3）
- 前端：`npx tsc --noEmit`
- Playwright MCP dev-browser：v3.3 全流程人工走过（admin 建 tag → managed 批量 create/update → tag_only attach 流 → submit form tag picker → /me 账号设置）

---

## 原 brainstorm 归档

原 `v3-plan.md` / `v3_2-plan.md` 已移到 `docs/archive/` 保留历史，**不再是真值**。
有语义冲突以本文档为准。
