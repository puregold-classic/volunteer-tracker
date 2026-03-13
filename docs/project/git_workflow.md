# Git 工作流（solo + AI）

## 分支结构

```
main        → 稳定版本，准备上线
develop     → 日常集成分支，当前工作基线
feature/*   → 单个功能/任务的开发分支
```

## 标准流程

```bash
# 开始新任务
git checkout develop && git pull origin develop
git checkout -b feature/task-name

# 开发中正常提交
git add <files>
git commit -m "feat: 描述"

# 完成后合并回 develop
git checkout develop
git merge feature/task-name --no-ff
git branch -d feature/task-name
```

## Commit 格式

```
feat:     新功能
fix:      修复 bug
refactor: 重构（不改行为）
chore:    配置、文档、依赖更新
style:    纯样式调整
```

## 规则

- Claude Executor 只在 `feature/*` 分支工作，不直接提交到 develop
- 任务完成 → Executor 汇报 → Owner 确认 → 合并到 develop
- `main` 只接受来自 `develop` 的稳定合并，上线时操作
- 每个 feature 分支对应一个明确任务，完成即删

## 紧急修复

```bash
git checkout main && git pull
git checkout -b hotfix/描述
# 修复后同时合并到 main 和 develop
```
