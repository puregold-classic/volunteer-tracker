# CLAUDE.md

该文件已废弃，不再作为当前协作架构的真实入口。

## Current Source of Truth

当前有效规则迁移到 OpenClaw workspace：

- `/home/zsy666/.openclaw/workspace/SOUL.md`
- `/home/zsy666/.openclaw/workspace/AGENTS.md`
- `/home/zsy666/.openclaw/workspace/USER.md`
- `/home/zsy666/.openclaw/workspace/registry/agents.yaml`
- `/home/zsy666/.openclaw/workspace/personas/coordinator/*`
- `/home/zsy666/.openclaw/workspace/personas/builder/*`

项目级共享事实仍以本仓库文件为准：

- `PROJECT.md`
- `DEVLOG.md`
- `DECISIONS.md`

## Deprecated

以下内容不再有效：

- “首席工程师 / 项目真正负责人” 这一单人格定义
- 基于 `QUESTIONS.md` 的旧 OC <-> Claude 协作协议
- `subagent / spawn / 自动唤醒 OC` 叙事
- 以本文件作为 Builder 或其他固定人格的私有 soul

## Temporary Rule

如果任何人格读到这个文件：

1. 不要把它当成当前执行协议
2. 返回 OpenClaw workspace 根目录读取最新规则
3. 按 `sessionKey -> persona` 路由进入对应 persona 文件
