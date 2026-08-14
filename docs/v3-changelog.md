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

- ~~志愿者 ID 改生日制~~ → **已在 v3.6 落地（见下）**

---

## v3.6 — 生日制 volunteerCode + 首页部门分组筛选（2026-06-24 落地）

### 生日制 volunteerCode

`volunteerCode` 从纯自增 `PG-NNNN` 升级为**生日制 + 流水兜底**：

- **格式**：`MMDD` + 去重字母（a→z），如 `0305a`。前 4 位生日月-日，末位字母区分同生日的人。
- **字母自动分配**：admin 只手填生日，系统挑该 MMDD 下一个没占的字母（user 拍板：不手敲字母）。
- **兜底**：没填生日 → 仍走旧 `PG-NNNN` 自增（user 拍板：允许 fallback，不卡录入）。
- **新增 `Volunteer.birthday DateTime?`**（migration `20260625..._add_volunteer_birthday`）——
  完整生日单独存字段（user："可能会用"，如生日祝福/年龄），code 只编码月-日。
- **兼容老格式**：`isValidVolunteerCode` / `validateIdFormat` 同时接受 `PG-\d{4}` 和 `\d{4}[a-z]`；
  `supportId` 泛化为 `PS-{code}-NNN`（`PS-0305a-001`），老 `PS-PG-0001-003` 仍合法。
- **并发安全**：同生日并发建档可能撞同字母，`AccountService.createVolunteerAccount` 在 volunteerCode
  唯一冲突上重试（重新取下一个字母），密码 hash 移到重试循环外只算一次。

落地：`schema.prisma` + `IDGenerator`（birthdayToMMDD / nextBirthdayCode / nextLegacyCode）+
`AccountService` + `serializer`（加 birthday）+ `AdminService` CSV（加 `生日` 列）+ `seed.js`
（sample 张/王同 03-05 → `0305a`/`0305b` 演示去重，陈无生日 → `PG-0001` 演示 fallback）+
前端 AdminCenter 建档表单加生日 date input。新 `IDGenerator.test.js`（12 例）。

### 首页部门筛选改成三大组 + hover 展开

`HomePage` 部门 filter 从平铺 `<Select>`（15 项）改成**三大组 chip**（翻译项目/组织培训/项目支援）：

- **hover 或点 ▾** → 弹出该组的具体部门列（带部门色点）+「选择整组」脚注
- **点组 chip 主体** → 选中该分类所有部门（chip 填入该 category 主色）
- 利用后端 `departmentId` 已支持的逗号分隔多值（`parseMulti` → `IN [...]`），**无需改后端**
- active filter chip 能把多 id 值反解成组名显示；分段 chip（label + chevron）让触屏也能点开

### 部署状态

| 环境 | Branch | HEAD | 备注 |
|---|---|---|---|
| 本地 dev（WSL + Docker） | develop | aa247d7 | birthday migration 已 apply + db-reset reseed 验证 |
| Mac mini sandbox | develop | aa247d7 | 同栈 migrate deploy（自动应用 birthday migration）+ reseed，已验证 |

测试：后端 160（+12 IDGenerator）、前端 54、tsc clean；首页 filter 用 Playwright 截图人工核过。

---

## v3.7 — tag createdById 可空 + 首页热门地点（2026-07-17 落地）

### 目的

- **tag 不再需要 owner。** `TagGroup`/`Tag` 是**组织配置**（Department/ServiceItem 的兄弟），
  不是用户拥有的内容。旧 schema 把 `createdById` 设成必填 FK，等于把审计信息当结构性必填，
  造成三个问题：(1) 权限本是**按角色** gate（group 建仅 `admin`），但 `admin.volunteerId=null`
  又被 service guard 拦 → **改动前 API 根本建不了 tag 组，只有 seed 能**；(2) 清空志愿者时
  为保 tag 配置被迫留占位号 volunteer；(3) `onDelete: Restrict` 把 tag 配置的存活耦合到某个
  志愿者的存活上（建过 tag 的人无法 offboard/硬删）。
- 收益：**系统管理员成为纯粹的系统管理员**，不再需要志愿者替身身份。

### 落地清单

- **schema**（`20260717174244_tag_created_by_nullable`）
  - `TagGroup.createdById` / `Tag.createdById` → `String?`，FK 改 `onDelete: SetNull`
  - 审计溯源不丢——真值一直在 `AuditLog`（operator 快照）
- **后端**
  - 拆掉 `TagService.create` / `TagGroupService.create` 里「需要 volunteer 身份」的 guard
    （与「group 创建仅 admin、admin.volunteerId=null」自相矛盾）。纯 admin 建 tag → `createdById=null`
  - `seed.js`：tag 组/tag 以 `createdById=null` 建，去掉「必须先有 volunteer」前置 + 不再造占位号
  - 前端无改动：`createdBy` 已是 `VolunteerSummary | null`，且 UI 从不渲染 tag 创建者
- **首页热门地点**（`useHomeState.ts` `HOT_LOCATIONS`）：广东/浙江/台湾省 → **北京/上海/广东/香港/澳门**。
  地图是省级 GeoJSON（含 `香港特别行政区`/`澳门特别行政区`），无市级多边形，故广州并入广东省。
  另：热力图 🔥 图标是数据驱动（`heatmapAvailable = provinceCounts.length>0`），0 志愿者时自动隐藏，非 bug。

### Mac sandbox 清库（2026-07-17，正式测试前）

清成纯净基线：删占位号 volunteer（`SetNull` 令 5 tag 组 + 19 tag 归系统所有）、清空 82 条
auditLog、重置月结锁定。**保留** 15 部门 / 77 服务项 / 5 tag 组 / 19 tag / admin 账号。
台账"残留提交记录"实为浏览器缓存——DB 层 `projectSupport=0`（硬刷新即清）。

测试：后端 162（+2 `TagGroupService.test.js`：admin/null 可建 + a_admin 仍记 volunteerId）；本地以纯
admin 端到端验证建 group+tag（`createdById=null`）+ 删除级联；Mac 验证 SetNull 后 tag 配置存活。

### 权限三层重排（同批，push `2628c91`）

按产品定位把 4 角色收敛成三层语义（**enum 不变，为将来分化留口子**），详见
`docs/architecture.md#角色与权限模型`：

- **user**：搜索 + 自己提交（不变）
- **录入员（a_admin ≡ b_admin，暂时一致）**：代提交（直接 ACTIVE）/ 看台账·审计·导出 /
  改志愿者信息 / 批量录入受训 + managed tag 批量 / 新建·改 tag / 跨人改·删·确认台账记录
- **admin（治理层）**：独占 部门·服务项·tag 组配置 / 账号管理（含建志愿者账号）/ 月结锁定 /
  封档期编辑豁免 / 重置系统

净改动两处方向移动：**b_admin 补齐到 a_admin**（tag CRUD + 批量：`tagRoutes` 加 b_admin、
`TagService` 写/批量 `isPrivileged`→`isBAdminOrAbove`、前端 `canWriteTags` 加 b_admin）；
**a_admin 收敛**（建志愿者账号 → admin only；月结锁定 → admin only；`ProjectSupportService`
`isAdmin` 拆成 `isReviewer`（录入员+ 跨人改删确认）+ `isSystemAdmin`（仅 admin 绕过月结封档））。

坑：批量录入受训**不是独立 endpoint**，长在 Tag 系统里（`TagService.batchCreate`，走 managed
tag 组的 `batch/create`），所以给录入员"批量录入受训"＝给它整个 managed tag 批量权限。
HTTP 实测：a_admin 建账号/锁定→403，b_admin 建/删 tag→201/200。后端 164 tests。

### bugfix：生日制 code 无法登录（push `3d7dde2`）

v3.6 加了生日制 code `0305a` 但只更新了 `isValidVolunteerCode`，漏了几处**判别 code 格式**的地方：
- 登录 `detectIdentifierKind` 的 shape 要求带 `-`，`0305a` 被判 invalid → 报"邮箱或密码错误"；
- `VolunteerService.findByIdOrCode`/`update` 用 `/^PG-\d{4}$/` 判别 → 生日码被当 cuid → 404。

修：`identifierUtils` 加 `BIRTHDAY_CODE_SHAPE`（字母归一化小写、放 phone 判别前）；VolunteerService
两处改用 `IDGenerator.isValidVolunteerCode`；`idUtils` supportId 正则兼容生日码（当前无调用者）。
HTTP 实测：login `0305a`/`0305A`→成功，`GET /volunteers/0305a`→200，`PG-0001` 仍可用。后端 165 tests。

> **volunteerCode 是不可变的人类 ID**：`supportId = PS-{code}-NNN` 内嵌了它，且它是登录标识。
> **生日可后补/修改**（push `d268e86`：编辑表单加生日字段 + 后端 `update` 白名单加 birthday），
> 但**补生日不重算 code**（by design）——生日单独存 `Volunteer.birthday`。想把已有 PG 码转成生日码
> 只能走**显式的重发动作**（未实现，需要时再加，带"改登录 ID + 历史 supportId 保留旧码"警告）。

### UI 打磨 + CSV 导入逐行校验（push `18627bc`）

- **密码框重复的小眼睛**：`ui/input.tsx` 自带 show/hide 眼睛，Edge 又给 `type=password` 加原生
  `::-ms-reveal`，两个叠一起。全局 CSS 隐藏原生的（`tailwind.css`）。Chromium 不渲染原生 reveal，验证需在 Edge。
- **管理中心右上角** 重复的「返回首页/退出」去掉（全局 Header 已有 Logo 回首页 + 退出登录）。
- **导入改成 Excel 直接粘贴 + 提交前逐行 dry-run 校验**：支持 Tab 分隔（Excel 复制）/ 无表头定位 /
  部门写中文名（网络技术部→NET_TECH）；新 `POST /admin/import-volunteers/validate`
  （`AdminService.validateVolunteersCsv`，不写库）。逐行检出：**部门存在/规范**、**省份规范全名**
  （辽宁→需辽宁省；大陆/台湾必填；台湾须"台湾省"）、中/英文名/邮箱/部门必填、状态/地区/角色枚举、
  邮箱格式/占用/批次内重复、生日可解析。前端 CSV dialog 加「校验」按钮 + 逐行结果面板。
- **省份真值源**：新 `backend/src/utils/provinces.js` + 前端镜像 `frontend/src/lib/provinces.ts`
  （34 个规范省名，对齐地图 GeoJSON）。**规范＝全名**（辽宁省，非辽宁），因为热力图/按省筛选拿
  `volunteer.province` 跟 GeoJSON 省名精确匹配。
- **省份防呆两层**（push `a84b53a`）：后端 `validateVolunteerPayload`（create）+ `VolunteerService.update`
  （edit，throw→400）校验大陆/台湾省份必须规范全名 + 台湾须"台湾省"；前端建档/编辑表单省份改**下拉**
  （大陆 33 个含港澳排台湾、台湾自动填台湾省、海外自由文本）。HTTP+Playwright 双验证。

---

## v3.8 — 部长(a_admin) 部门作用域角色（2026-07-17 落地）

重定义 `a_admin` 为**部长**（零 migration，用 v3.7 留的分化口子）。4 角色：user(志愿者) /
b_admin(录入员,全局录入不变) / **a_admin(部长)** / admin。部长作用域 = 自己 `volunteer.departmentId`。

- **本部门人事**：建号(锁部门+只设user/b_admin)/改人/停用/重置密码/设角色。**别部门只读**。
- **本部门台账写**：代提交/批量录入受训/改删本部门记录。**全局只读台账**（reviewer read）。
- **不能**：碰别部门写、全局配置、建 admin/部长、删账号、月结锁定。指定部长仅 admin。
- 后端：`authenticate` 带 departmentId；新 `utils/deptScope.js`；`ProjectSupportService` isReviewer→
  `canManageRecord`(部长按记录 owner 部门)；`TagService` 批量限本部门；人事路由放开 a_admin+作用域。
- 前端：新 `/team` 路由 + 「人事管理」导航(仅部长，保留 /me)；AdminCenter 按角色自适应；ROLE_LABELS 中文化。
- 后端 187 tests；本地 HTTP + Playwright 全绿。commit `72ec4a9`。

---

## v3.8.1 — 删除志愿者修复（2026-08-14 落地）

线上症状：**部长点删除志愿者一直失败**。Mac sandbox 日志确认是 `DELETE /auth/admin/accounts/:id`
稳定 403 —— v3.8 把 `/team` 开给了部长，但删除路由仍是 `authorizeRoles('admin')`，前端又没按角色
隐藏删除按钮，于是按钮看着能点、点了必挂。

- **放权**（本次决策，改了 v3.8「部长不能删账号」那条）：部长可删**本部门**的 user / 录入员。
  路由放开 a_admin，`AccountService.deleteAccount` 里用 `assertDeptScope` +
  `DEPT_HEAD_ASSIGNABLE_ROLES` 兜底；删部长/admin、删别部门仍 403。签名从裸 `currentUserId`
  改成 `operator`（和 `updateAccount` 对齐）。
- **顺带修的真 500**：`deleteAccount` 只挡了 ProjectSupport，漏了 `volunteer_lists` /
  `volunteer_list_members` / `tag_attachments` 三张硬 FK 表。被谁加进过「我的关注」的人一删就撞
  P2003 → 500。现在 list 关系（私有工作区数据）随人删掉，标签操作痕迹和台账一样显式挡下并给人话。
  `AdminService.resetToSystemAdmin` 同一个坑（清库会 FK 报错），一并补上 list 两张表。
- 前端：AdminCenter 删除按钮按角色 disable（部长对部长/admin 灰掉并提示原因）。
- 后端 195 tests（新增 6 个：tag-attachment 拦截 / list cascade / 部长作用域 4 例）；前端 `tsc --noEmit` 绿。

**遗留**：`TagAttachment.attachedById` 仍是硬 FK。按 v3.7 对 `Tag.createdById` 的同一套理由
（操作者是快照不是拥有关系），后续可改 nullable + `onDelete: SetNull`，那样有标签痕迹的人也能删。
另：删除账号目前**不写 AuditLog**，部长有删除权之后建议补。

---

## 当前部署状态（2026-07-17）

| 环境 | Branch | HEAD | 备注 |
|---|---|---|---|
| 本地 dev（WSL + Docker） | develop | fe42dd0 | v3.7 …+省份防呆下拉+Excel粘贴导入 |
| Mac mini sandbox | develop | fe42dd0 | https://dev.puregoldclassictranslation.com · v3.7 全部已 deploy + **清库到纯净测试基线**（配置+admin，0 志愿者/记录/日志） |
| 生产 | — | — | 未上 |

> v3.5 deploy 流程：push develop → Mac `git pull` → `docker compose --env-file .env.deploy
> -f docker-compose.deploy.yml up -d --build` → 同栈 `exec -T backend npx prisma db seed`
> （部门/服务是 seed 数据，rebuild 不会自动应用，必须 reseed）。

### 登录凭证（sandbox）

- Admin：`admin@puregoldclassictranslation.com` / `q4m2GlqtriDp0cglzGqa`
- 样例志愿者：`PG-0001` … `PG-0004` / `Sample@123`（**仅本地 seed 有**；Mac 2026-07-17 已清库，只剩 admin，等正式测试录真数据）

### 测试覆盖

- 后端：`make test` — 164 tests（v3.7 加 `TagGroupService.test.js` 2 个 nullable-owner + 权限重排 3 个回归：b_admin 代确认 / a_admin 受月结锁 / unrelated-user 拒绝；v3.5 `TagService.test.js` 2 个 listSupports 回归）
- 前端：`npx tsc --noEmit`
- Playwright MCP dev-browser：v3.3 全流程人工走过（admin 建 tag → managed 批量 create/update → tag_only attach 流 → submit form tag picker → /me 账号设置）

---

## 原 brainstorm 归档

原 `v3-plan.md` / `v3_2-plan.md` 已移到 `docs/archive/` 保留历史，**不再是真值**。
有语义冲突以本文档为准。
