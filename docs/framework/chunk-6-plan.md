# Chunk 6 — 前端视觉重做计划

写于 2026-04-08，task #6 启动前的对齐文档。**这是给 user 拍板用的**，不是 spec。所有「待定」项需要 user 回答后才进入实施。

## 0. 为什么 chunk 3 之后还要做 chunk 6

Chunk 3（前端 API 适配）只解决了 **「能跑」**：UI 跟 v2.1 backend 的 contract 对得上、tsc 通过、vite build 成功。它**没碰视觉**——MePage / AdminCenter / 项目支援台账都是 self-contained 的最小 placeholder，复用了原来的 .scss class，长得跟 v1 一样。

Chunk 6 是 **「能看」**：把整个前端按 v2.1 的产品形态重新设计 + 实现，引入 frontend-design + ui-ux-pro-max 两个 skill 来避免"AI 默认平庸态"。

任务 #5 的前端 inventory（已完成）给出了 baseline 痛点清单，下面都会被 chunk 6 处理掉。

---

## 1. 任务 #5 inventory 总结：现在到底丑/烂在哪

| # | 问题 | 影响 | chunk 6 怎么修 |
|---|---|---|---|
| 1 | 哈希路由（手卷的 `parseHashRoute()`），不是 react-router | 没法用 v6 的 nested routes / loader / route guard / 404 / link 行为 | 上 react-router-dom v6 |
| 2 | MePage 是「垃圾抽屉」：档案 + NPS + AdminCenter 全塞一个文件 | 维护噩梦，70+ useState | 按角色拆 `/me`、`/admin`、`/admin/volunteers` 等独立路由 |
| 3 | SCSS 残留 1000+ 行（MePage.scss / ReviewPage.scss / HomeMap.scss / global.scss / variables.scss） | dark mode 优先级冲突，调试痛苦；且 CLAUDE.md 撒谎说"已迁移完" | 全量删 .scss，纯 Tailwind v4 |
| 4 | **没有路由守卫** | token 过期但页面没刷新 → 用户看到 admin UI 但 API 都 401 | react-router 的 loader 检 auth；统一 unauthorized handler |
| 5 | 没有 shadcn/ui，所有基础组件手写 | 视觉一致性差；缺好用的 Dialog/Drawer/Combobox | 上 shadcn/ui，作为整套设计系统的载体 |
| 6 | 没有表单库，每个表单自己管 loading/error/submitting 散落各处 | 提交逻辑重复，UX 不一致 | 上 react-hook-form + zod |
| 7 | 类型定义曾分散，chunk 3 已经收敛到 `services/types.ts` | ✓ 已修 | 继续保持 |
| 8 | 状态同步靠手动刷新（MeCenter ←→ ReviewCenter） | 数据陈旧；用户体验断裂 | 上 TanStack Query (react-query)，所有 API 调用走 query/mutation |
| 9 | 测试覆盖极低（前端只有 useHomeState 一个测试） | 重做后回归靠肉眼 | chunk 6 不强求测试覆盖（视觉变化太大），但关键 hook + form 写 vitest 测试 |
| 10 | HomeMap 区域硬编码，HOMETMAP 5 大区域坐标和样式都在源码 | 加新区域要改源码 | 重做时把 region metadata 抽到 reference data |

---

## 2. 两个 skill 的定位

### frontend-design（Anthropic 官方）

**哲学**：committed bold aesthetic > 安全平庸。强制做 4 件事：
1. 选定一个**明确的美学方向**（minimalist / brutalist / retro-futuristic / art deco / 等）
2. **避免**通用字体（Inter / Roboto / Arial）、紫色渐变、对称稳重布局
3. 用**主色 + 锐利 accent** 而不是均匀调色板
4. 一次"high-impact 编排"动效 > 散落的 micro-interactions

**输出形式**：CSS-first（用 framer-motion / Motion 库给 React 项目），可以输出 React 组件 + 完整页面。

**约束**：它不下载，是个**激活机制**——只要 Claude Code 启用了这个 plugin，遇到「build a frontend」这种 prompt 自动激活。

### ui-ux-pro-max（第三方，nextlevelbuilder）

**数据库驱动**，v2.0 含：
- 67 UI styles
- 161 color palettes
- 57 font pairings
- 99 UX guidelines  
- 161 reasoning rules（按产品品类）
- 25 chart types

**Design System Generator**：给一个产品描述（"志愿者管理工具，内部用，需要清晰的数据浏览 + 表单"），输出一份完整 design system（颜色、字体、间距、组件 token、anti-pattern 列表）。

**安装**：
```bash
npm install -g uipro-cli
cd <project>
uipro init --ai claude
```

**使用**：自动激活（请求里有 "build" / "design" 等关键词），或显式 `/ui-ux-pro-max <prompt>` slash command，或 `python3 .claude/skills/ui-ux-pro-max/scripts/search.py "..." --design-system -p "ProjectName"`。

支持的 tech stack 包括 React + shadcn/ui（这正是我们要的）。

### 互补关系

- **ui-ux-pro-max** 解决"我应该选什么"——给 grounded 的选项数据库
- **frontend-design** 解决"选完之后能不能做出胆量"——避免一选就退回平庸

我的建议流程：
1. 先 `uipro` 生成 3 套备选 design system（不同方向：极简 / Brutalist / Bento）
2. user 选一套
3. `frontend-design` skill 自动驱动，按 user 选定的方向做实现

---

## 3. 待 user 拍板的关键决策（在 chunk 6 启动前）

### 决策 1: 美学方向（最重要）

我会用 ui-ux-pro-max 生成 3 套备选 design system 给 user 选。可能方向（不绑定，user 可以换）：

| 方向 | 适合 | 不适合 | 长成什么样 |
|---|---|---|---|
| **Minimalist + Bento Grid** | 数据浏览为主 / 想"高级感" / 多平台后续扩展 | 不够"纯金经典翻译"那种文化属性 | 大量留白、卡片按 grid 排、单色 + 1 个强调色 |
| **Editorial / Newspaper** | 文化机构 / 翻译相关 / 内容驱动 | 数据密集页面会乱 | serif 标题、有印刷感、衬线 + 无衬线对比 |
| **Modern Brutalism** | 想要"被记住" / 差异化 | 保守组织接受不了 | 厚边框、单色块、不柔和、强反差 |
| **Retro-futuristic / 80s tech** | 技术氛围 / 有"实验"感 | 跟"志愿者公益"的温暖感冲突 | grid 渐变、neon accent、sci-fi 字体 |
| **Warm Editorial（推荐起手）** | 兼顾文化感 + 数据可读 + 不极端 | — | 暖色系、衬线标题、宽松排版、温和动效 |

User 需要回答：「想要哪个方向 / 想看 ui-ux-pro-max 真的生成几套之后再选」。

### 决策 2: 是否引入 shadcn/ui

利：
- 一次性拿到 50+ 高质量组件（Dialog / Drawer / Command / Combobox / DataTable / Sheet / Form / 等）
- 跟 ui-ux-pro-max 配合最好
- 复制源码到项目，不是 black-box 依赖
- Tailwind v4 + Radix 的标准搭子

弊：
- 一次性引入 ~30 个组件源文件，仓库变大
- shadcn 的默认配色是「灰 + neutral」，需要按选定的美学方向重新 tokenize

**我的强推**：上 shadcn/ui。chunk 6 没它会做得很累。

### 决策 3: 路由 + 表单 + 状态库

| 工具 | 用途 | 必要性 |
|---|---|---|
| react-router-dom v6 | 替换哈希路由；nested routes；loader 守卫 | **必须**（哈希路由维护代价太大） |
| react-hook-form + zod | 表单状态 + schema validation | **必须**（散落 useState 状态地狱不能继续） |
| @tanstack/react-query | API 缓存 + 请求去重 + 自动重新验证 | **强推**（解决"页面间数据陈旧"问题） |
| framer-motion 或 Motion | 页面进入 / 列表交错动效 | 推荐（frontend-design skill 默认推荐） |

### 决策 4: 移动端等级

任务 #5 inventory 提到 v1 桌面优先。chunk 6 是不是要 mobile 一等公民？

| 选项 | 含义 | 工作量增量 |
|---|---|---|
| Desktop-first（v1 一致） | 桌面尺寸优先优化，mobile 能看就行 | +0% |
| Responsive | 桌面 + 平板 + 手机三档都要可用 | +25% |
| Mobile-first | 先做手机版再桌面 | +40%，需重构布局思路 |

数据点：项目是「志愿者管理」工具，部分志愿者会在手机上提交服务记录 → **Responsive 是最低标准**。Mobile-first 不必要。

### 决策 5: 一次重做 vs 渐进式

| 选项 | 描述 | 风险 |
|---|---|---|
| **一次重做 (big bang)** | 长分支上重写所有页面，dev sandbox 中断几天，最后一次性切换 | 期间 sandbox 不可用；切换日可能集中爆 bug |
| **渐进式 (page-by-page)** | 一次只改一个页面，随时部署。新页面用新组件，旧页面留原样 | 期间风格混搭很丑；持续半个月 |

**我的建议**：HomePage + LoginPage 先做（公开页面，最影响第一印象），稳定后做 MePage / AdminCenter，最后做 ReviewLedger / VolunteerDetail。每个页面 commit 一次。期间 dev sandbox 始终可用，只是不同页面风格会有几天不一致。

---

## 4. 实施顺序（一旦决策齐了）

```
phase A — 基建（0.5 天）
  1. 安装 ui-ux-pro-max + frontend-design plugin
  2. 装 shadcn/ui，初始化 components.json，迁移 5-10 个最基础组件
  3. 装 react-router-dom v6，把 App.tsx 的哈希路由换掉
  4. 装 react-hook-form + zod
  5. 装 @tanstack/react-query，包一个 QueryClientProvider
  6. 全量删 .scss 文件，把 main.tsx 的 import 也删

phase B — 设计系统（user 在这里拍板）
  7. uipro 跑一次 design-system generation，给 user 看 3-5 套备选
  8. user 选一套
  9. 把选中的 token（颜色、字体、间距）写进 tailwind.config + CSS variables

phase C — 公开页（2 天）
  10. HomePage 重做（含 HomeMap 集成）
  11. LoginPage 重做
  12. VolunteerDetailPage 重做（公开侧）

phase D — 用户域（2-3 天）
  13. MePage 拆成独立路由：/me（个人档案）、/me/supports（项目支援列表）、/me/pending（待确认）、/me/submit（提交表单）
  14. 提交表单用 react-hook-form + zod，部门 → service item 二级联动
  15. 状态机 confirm / reject 用 mutation + optimistic update

phase E — admin 域（2-3 天）
  16. AdminCenter 重做：account list 用 shadcn DataTable，create form 用 react-hook-form
  17. /admin/volunteers / /admin/departments / /admin/service-items 独立路由
  18. /admin/system-settings 月结锁定 UI

phase F — 项目支援台账（1 天）
  19. ReviewPage 重做：图表（recharts/chart.js）展示总览、按部门、时间序列
  20. ledgerService 的 5 个端点全部接上

phase G — 收尾
  21. 路由守卫，401 全局拦截
  22. 暗色模式 polish
  23. 移动端 responsive sweep
  24. 关键 hook 写 vitest 测试
  25. CLAUDE.md 把"SCSS 已迁移"那条改成真实状态
```

预估总工作量：1-2 周纯实施时间。

---

## 5. Chunk 6 的成功标准

我会拿这些作为 done 的判据：

- [ ] dev sandbox 上 5 个核心页面（home / login / me / admin / ledger）的视觉跟 v1 完全不同
- [ ] 跟 user 选定的美学方向一致（不能是"AI 默认灰白蓝"）
- [ ] react-router 替换完，0 处 `window.location.hash`
- [ ] 0 个 .scss 文件
- [ ] 0 个 useState 用作表单字段（react-hook-form 全包）
- [ ] tsc + vite build 通过
- [ ] playwright probe（home + login + me + admin + ledger 共 5 个页面）0 console error 0 page error
- [ ] mobile responsive (375px) 不破版
- [ ] 跟你做过 1 轮设计 review，至少 3 次"细节微调"迭代

---

## 6. 风险 + 回滚

| 风险 | 可能性 | 应对 |
|---|---|---|
| ui-ux-pro-max 装不上（依赖冲突 / npm 全局权限） | 中 | 退回 frontend-design 单 skill 用 |
| 选了的美学方向中途想换 | 高 | 设计系统是 token 化的，换方向只需要重新生成 token + tailwind 配置 |
| react-router 迁移碰到隐藏的 deep link 用法 | 低 | 路由迁移先做小步，每步都跑 e2e probe |
| shadcn DataTable 不够用（admin account list 可能有复杂筛选） | 中 | 退回 TanStack Table，shadcn 只用基础组件 |
| 1-2 周时间不够 | 中 | 渐进式策略允许任意时刻停下，部分页面新视觉 + 部分页面老视觉是可接受的中间态 |

回滚：每个 phase 都是独立 commit；如果某个 phase 做出来 user 不喜欢，`git revert` 那段 + 重新尝试。chunk 6 全程都在 develop 分支，不动 main。

---

## 7. 我等你回来回答的事

按重要性：

1. **要不要先让 ui-ux-pro-max 生成 3-5 套 design system 给你看**？还是直接告诉我方向（比如「Warm Editorial」）？
2. **shadcn/ui 同意上吗**？强推。
3. **react-router / react-hook-form / react-query 三件套同意上吗**？强推。
4. **mobile 等级**：Responsive（推荐）/ Desktop-only / Mobile-first？
5. **重做策略**：渐进式（推荐）/ 一次重做？
6. **chunk 6 实施时机**：现在就开 / 等其他事 / 先 polish 一些 chunk 3 的细节再开？

这些回答完，我开 phase A。phase B 那一步会再停一下让你选 design system。

---

## 附：参考资源

- frontend-design plugin: <https://claude.com/plugins/frontend-design>
- frontend-design SKILL.md: <https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md>
- ui-ux-pro-max: <https://ui-ux-pro-max-skill.nextlevelbuilder.io/>
- ui-ux-pro-max GitHub: <https://github.com/nextlevelbuilder/ui-ux-pro-max-skill>
- shadcn/ui docs: <https://ui.shadcn.com>
- TanStack Query: <https://tanstack.com/query/latest>
- react-router v6: <https://reactrouter.com>
