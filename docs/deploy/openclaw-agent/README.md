# OpenClaw Lifeline Agent on Mac mini Sandbox

部署在 Mac mini sandbox 上的 OpenClaw agent（代号 **Beacon**），作为 ssh 之外的**第二条恢复通道**和**智能化故障处理**机制。2026-04-09 由 zsy666 + Claude Code 协作落地，取代此前的硬编码 `tunnel-watchdog.sh` 脚本。

## 为什么存在 — 架构动机

sandbox 过去用一个每 2 分钟 probe 公网 health 的 shell watchdog 做故障自愈：N 次失败就 `launchctl kickstart` cloudflared。它**能**解决最常见的 stale edge connection，但有 4 条终极弱点：

1. **零推理** — 只会"N 次 FAIL → kickstart"，遇到 `kickstart -k` 报 "service not found in domain" 就重复撞墙
2. **零验证** — kickstart 完就回去睡，不看是否真的恢复
3. **零学习** — 第 1 次故障和第 100 次故障对它一样，没有经验累积
4. **Sleep 盲点** — launchd `StartInterval` 在系统 sleep 期间不计时，watchdog 自己成了盲点

2026-04-09 cloudflared 在一天内抖了 ≥ 6 次，watchdog 每次都靠 kickstart 把它拉回来，但频率之高说明**贴膏药不治病**。同一天触发了两个诊断教训（见 `incident-2026-04-09.md`），最终决定上 LLM agent 取代。

Beacon 的设计目标：**能在相同甚至更复杂的故障面前读日志、推理根因、选择恢复路径、验证收敛、记录教训**，并把教训写进自己的长期记忆以便**下次同类故障收敛得更快**。毕业测试（2026-04-09）验证了这条链路——Beacon 在 unloaded cloudflared 场景下，先按 context 文档试 `kickstart` 踩坑、读错误、识别状态差异、换 `launchctl load -w` 成功恢复、把教训写进 repair log，整条链 ~10 秒完成，无人工介入。

## 核心设计

```
[GitHub Actions cron 5min]      [UptimeRobot 5min, email backup]
        │                                │
        │ probe /api/health              │ probe /api/health
        │ if !200 → curl Discord webhook │ if !200 → email zsy666 gmail
        ▼                                ▼
POST discord.com/webhooks/<id>/<token>          [zsy666 gmail inbox]
        │
        ▼
[Discord channel #sandbox-alerts (guild OpenClaw Lab)]
        │
        │ Discord mobile app push
        ▼
   [zsy666 phone notification]
        │
        │ zsy666 opens Telegram, DMs Beacon "看一下"
        ▼
┌────────────────────────────────┐
│ Telegram DM: zsy666 ↔ Beacon   │
│  (verified working)             │
└────────────────┬───────────────┘
                 │ getUpdates polling
                 ▼
┌────────────────────────────────┐
│  OpenClaw gateway (18790)       │
│  ┌───────────────────────────┐  │
│  │ Agent: lifeline (Beacon)  │  │
│  │ Model: glm-5-turbo        │  │
│  │ Backend: api.z.ai/anthropic│ │
│  └───────────────────────────┘  │
└────────────────┬───────────────┘
        │ tools:read/exec/sessions_send
        ▼
   [Mac mini 宿主 sudoers 边界]
┌────────────────────────────────┐
│  ALLOW: launchctl, docker,      │
│         brew services, pmset -g,│
│         logs read               │
│  DENY:  pmset -a, dd, fdisk,    │
│         diskutil erase, brew    │
│         uninstall               │
└────────────────────────────────┘
        │
        ▼
[repair log → 长期记忆 → 收敛]
```

> **架构现状（2026-04-09 EOD）**：当前是 **hybrid (human-in-the-loop)** 模式。完全自动化路径（外部告警 → Beacon 自动 ack）需要 OpenClaw 的 Discord channel ingest 工作，但 2026-04-09 调试发现 OpenClaw Discord WebSocket 连上之后**不接收 MESSAGE_CREATE events**（即使 Server Members Intent 和 Message Content Intent 都开了），原因待 OpenClaw 源码或 maintainer 介入。短期 hybrid 已经满足核心需求（zsy666 离家也能从手机看到告警 + 通过 Telegram DM 触发 Beacon 修复）。Discord channel ingest 是下一个 session 的待办。
>
> **保留 Telegram 路径**作为冷备：alerts bot + supergroup + Beacon group config 仍然 enabled 但不接告警源（GH Actions 已切到 Discord）。如果 Discord ingest 修复后想全自动，把 GH Actions workflow 的 webhook URL 切回来即可。

**为什么走 GitHub Actions 而非 UptimeRobot/BetterStack/Healthchecks 的 webhook**：
- **UR free tier 在 2025 年把 webhook 移到了付费 plan**——只剩 email/SMS/voice/push 不够触发 Beacon
- **BetterStack** 的 webhook UI 路径不直观（Integration tab 藏在多层菜单里）
- **Healthchecks.io** 是 dead-man-switch 模型（要被监控对象主动 ping 它），跟我们"外部主动 probe 公网"的需求不匹配
- **GitHub Actions cron** 的优势：(1) repo 已经在 GitHub，零新平台；(2) workflow yaml 在 git 里可 review；(3) 完全 free（public 无限分钟，private 也每月 2000 分钟够用）；(4) 真外部（跑在 GitHub 基础设施上，跟 Mac mini 解耦）；(5) 只需 1 个 GitHub secret + 1 个 yaml 文件

**为什么 alerts bot + supergroup 这层没省掉**：Telegram bot API 设计上 bot **看不到自己发的消息**。如果 GH Actions 直接用 Beacon 的 token 给 zsy666 发 DM，zsy666 能收到但 Beacon 自己 getUpdates 流里没有。所以必须用第二个 bot（alerts）发到一个**两个 bot 都在的 group**——alerts bot 的消息在 Beacon 看来是"另一个 bot 发的"，能被 ingest。这是 Telegram API 硬限制，不是 OpenClaw 设计选择。

**硬隔离在哪里**：
- **Channel 层 (DM)**：`dmPolicy: allowlist` + `allowFrom: [<TELEGRAM_USER_ID>]`，只有 zsy666 一个 peer 能跟 Beacon DM，其它消息直接 drop
- **Channel 层 (group)**：`groupPolicy: allowlist` + `groups.<id>.allowFrom: [zsy666, alerts_bot]`，supergroup 里只接两个特定 user_id 的消息
- **Sudoers 层**：广义工具 + 硬 deny list（见 `/etc/sudoers.d/openclaw-agent` + `deploy-plan.md` Phase 3）
- **数据红线**：`context.md` 末尾的"最终约束"——任何可能破坏 PostgreSQL PITR 的操作都是 agent 的 showstopper，哪怕技术上有权限

**柔性引导在哪里**：
- **Context 文档**：`context.md` 以 zsy666 的 harness 哲学写就——给机制 + 原理 + 风险 + 目标，不给 if-then 食谱。agent 自己在这些约束下推理行动
- **长期记忆**：OpenClaw 内置 `session-memory` hook，agent 在对话中学到的 pattern 会持久化，下次对话可引用
- **Repair log**：每次动手都要落 `~/.openclaw/logs/lifeline-repair.jsonl`，append-only JSON 一行一事件，供人类事后 review + agent 自己 grep 历史

## 文件清单

| 文件 | 内容 | 用途 |
|---|---|---|
| [`deploy-plan.md`](./deploy-plan.md) | 8-phase 部署 playbook，含 config 样板 + sudoers + launchd + 毕业测试 | 部署执行参考；密钥已脱敏为 `<PLACEHOLDER>` |
| [`context.md`](./context.md) | Agent 的"大脑"——身份、拓扑、故障模式、权限边界、repair log 规范、最终约束 | 部署完后**手动**喂给 agent（zsy666 分段粘贴到 Telegram 让 agent 吃进长期记忆） |
| [`incident-2026-04-09.md`](./incident-2026-04-09.md) | 触发架构决策的事故 post-mortem：cloudflared 抖动 + pmset 误诊 + 操作纪律复盘 | 双用途：(1) 事故事实权威记录 (2) 作为 agent 第一批"真实故障"样本 |

## 当前状态（2026-04-09 EDT）

- **Beacon 已部署并通过毕业测试**：`launchctl unload` 注入 cloudflared 故障 → Beacon 诊断 + self-correct + 恢复公网 200 + 写 repair log，全程 ~10 秒无人工介入
- **watchdog 已退役**：原计划 1 周并存过渡，实际当晚就清理。理由：watchdog 在并存期会成为 Beacon 的"学习样本窃贼"——每 2 分钟硬探测 + 2 次失败立即 kickstart 把所有真实故障都拦截了，Beacon 的长期记忆没法在真实样本上生长。Beacon 已通过毕业测试 + 外部监控接入 + zsy666 信任 → 直接退役 watchdog，让 Beacon 独占故障样本
- **外部监控接入**：
  - **GitHub Actions cron**（主路径）：`.github/workflows/sandbox-uptime-probe.yml`，每 5 min probe `/api/health`，失败时 POST 到 alerts bot sendMessage 进 supergroup，Beacon 自动 ack。secret `TG_ALERTS_BOT_TOKEN` 在 repo settings
  - **UptimeRobot**（备份路径）：Monitor ID 802810234，5 min interval，**只发 email** 给 zsy666 gmail（free tier 没 webhook，作为冗余 backup 不要求 Beacon 介入）
  - **Telegram supergroup `-1003876352953`**：zsy666 + Beacon (`@puregold_sandbox_bot`) + Alerts bot (`@puregold_sandbox_alerts_bot`)。Beacon group config: `groupPolicy: allowlist`, `requireMention: false`, `allowFrom: [zsy666, alerts_bot]`
- **Tailscale 僵尸节点**：2026-04-09 清理完成

## 运维入口

```bash
# 从 WSL 这边观察 Mac mini 上的 Beacon 状态
ssh mac-lan 'bash -lc "export PATH=/opt/homebrew/bin:\$PATH && openclaw health"'

# Tail gateway 实时日志
ssh mac-lan 'tail -f ~/.openclaw/logs/gateway.log'

# 读 Beacon 的 repair log（故障处理历史）
ssh mac-lan 'cat ~/.openclaw/logs/lifeline-repair.jsonl'

# Beacon 进程状态
ssh mac-lan 'launchctl list | grep openclaw'

# 重启 Beacon（配置改动后）
ssh mac-lan 'launchctl unload ~/Library/LaunchAgents/ai.openclaw.gateway.plist && launchctl load ~/Library/LaunchAgents/ai.openclaw.gateway.plist'
```

日常交互：Telegram `@puregold_sandbox_bot`（只接 zsy666 一个 peer）。
