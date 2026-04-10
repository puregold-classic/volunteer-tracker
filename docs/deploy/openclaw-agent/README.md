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
两条独立 outbound 通道，故障域不相交，对同一故障同时反应：

╔═══════════════════════════════╗   ╔═══════════════════════════════╗
║  Layer 1: External Observer   ║   ║  Layer 2: Internal Self-Heal  ║
║  (你的眼睛)                   ║   ║  (Beacon 的手)                ║
╠═══════════════════════════════╣   ╠═══════════════════════════════╣
║ GH Actions cron every 5min    ║   ║ openclaw cron every 1min      ║
║   ↓ probe /api/health         ║   ║   ↓ probe /api/health         ║
║   ↓ if fail (200 + status:ok) ║   ║   ↓ if fail (same probe)      ║
║ Telegram Bot API sendMessage  ║   ║ Beacon agent turn (isolated)  ║
║   token: Beacon's bot token   ║   ║   - read cloudflared logs     ║
║   chat_id: zsy666 (7242492853)║   ║   - launchctl bootstrap+kick  ║
║   ↓                           ║   ║   - verify HTTP 200           ║
║ zsy666 phone Telegram push    ║   ║   - write JSONL repair log    ║
║ "[UPTIME-ALERT] DOWN..."      ║   ║   (silent — no external msg)  ║
╚═══════════════════════════════╝   ╚═══════════════════════════════╝
              ║                                  ║
              ║                                  ║
              ╚══════════════╦═══════════════════╝
                             ║ 同时反应同一故障
                             ║ 跨 GitHub infra ↔ Mac mini 故障域
                             ▼
              你拿出手机看 alert → 公网通常已经被 Beacon 修好了
              人工 override：DM Beacon 直接对话 (Telegram channel,
              dmPolicy: allowlist → only zsy666)

              ┌──────────────────────────────────┐
              │  Beacon (lifeline agent) on Mac  │
              │  · gateway 18790 (loopback)      │
              │  · model: glm-5-turbo            │
              │  · backend: api.z.ai/anthropic   │
              │  · cron: every 1min, exec+read   │
              │  · DM channel: zsy666 only       │
              └────────┬─────────────────────────┘
                       │
                       ▼
         /etc/sudoers.d/openclaw-agent
         ALLOW: launchctl, docker, brew services,
                pmset -g, logs read
         DENY:  pmset -a, dd, fdisk, diskutil erase,
                brew uninstall
                       │
                       ▼
         ~/.openclaw/logs/lifeline-repair.jsonl
         (audit trail + 长期记忆收敛)
```

> **架构最终形态（2026-04-09 EOD）**：**双层独立 outbound** 架构。两层在故障域上解耦——Layer 1 在 GitHub 基础设施上，Layer 2 在 Mac mini 上。同时对故障反应，不互相依赖。
>
> **关键反思**：本来还想做"GH Actions push → Beacon 自动 ack"的全自动路径，需要 channel ingest（Discord 或 Telegram supergroup）。但所有 inbound-style 的方案都违反"不能依赖 inbound"的根本约束（ssh/任何监听端口恰恰是出问题的层）。最终架构**全 outbound**：Beacon 内部 cron 主动 poll，GH Actions 也是主动 poll + 主动 push notification。**bot 看不到自己发的消息**这个 Telegram 限制对 one-way notification 完全无害——zsy666 只需"看到"，不需要 bot 自己处理这条 alert。
>
> **冷备**：早期试过的 Discord channel + Telegram supergroup + alerts bot 全部仍然在 OpenClaw config 里 `enabled` 但**没有任何源在 push 消息**。standby spare 不动它们。如果未来想做"channel ingest 自动 ack"那条路径，需要先解决 OpenClaw 的 Discord MESSAGE_CREATE ingest 不工作问题——本 session 没解，待 OpenClaw 源码深读或 upstream issue。

**为什么走 GitHub Actions 而非 UptimeRobot/BetterStack/Healthchecks 的 webhook**：
- **UR free tier 在 2025 年把 webhook 移到了付费 plan**——只剩 email/SMS/voice/push
- **BetterStack** 的 webhook UI 路径不直观，未完成 setup
- **Healthchecks.io** 是 dead-man-switch 模型（要被监控对象主动 ping 它），跟我们"外部主动 probe 公网"的需求不匹配
- **GitHub Actions cron**：repo 已在 GitHub，零新平台；workflow yaml 在 git 里可 review；完全 free；真外部；只需 1 个 GH secret + 1 个 yaml 文件

**为什么不用 ssh 注入 message 到 Beacon**：理论上 GH Actions 可以通过 Tailscale + ssh + `openclaw agent --message` 直接戳穿 gateway 给 Beacon 注入 turn。但**ssh 恰恰是最容易出问题的层**——ssh 不通的时候才特别需要 lifeline。如果恢复路径依赖 ssh，相当于 single-point-of-failure 套娃。最终架构**两层都 outbound**：GH Actions → Telegram bot API；Beacon → 自身 cron 内调用。Mac mini 只需要 outbound HTTPS 这个最低基线。

**硬隔离在哪里**：
- **Channel 层 (DM)**：`dmPolicy: allowlist` + `allowFrom: [<TELEGRAM_USER_ID>]`，只有 zsy666 一个 peer 能跟 Beacon DM 双向对话，其它消息直接 drop。GH Actions 用 Beacon bot token 给 zsy666 DM 发的 alert 是 one-way 的（bot 自己不接收，没影响）
- **Channel 层 (cold spare)**：Telegram supergroup + alerts bot + Discord channel 全部 enabled 但无活动源
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
- **Layer 1 — External alert (GitHub Actions cron)**：`.github/workflows/sandbox-uptime-probe.yml`，每 5 min probe `/api/health`，失败时用 Beacon bot token 直接 POST `sendMessage` 到 zsy666 DM (chat_id `7242492853`)。一条 one-way notification。Secret `TG_BEACON_BOT_TOKEN` 在 repo settings
- **Layer 2 — Internal self-healing (OpenClaw cron)**：cron job `lifeline-probe` (id `41288933-...`)，every 1 min，运行 lifeline agent turn。Agent 用 `exec/read` 工具自己 probe 公网，PASS 静默，FAIL 自主诊断+恢复+写 `~/.openclaw/logs/lifeline-repair.jsonl`。**完全沉默**，不发任何外部通知（避免跟 Layer 1 重复）
- **UptimeRobot**（独立第三层）：Monitor ID 802810234，5 min interval，**只发 email** 给 zsy666 gmail。free tier 没 webhook，作为冗余 backup（如果 Beacon **和** GH Actions 同时挂了，UR email 仍能告警）
- **Cold spare**（不动）：Discord channel + Telegram supergroup + alerts bot 全部在 OpenClaw config 里 `enabled` 但无活动源
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

# 看 Beacon 自愈 cron 历史
ssh mac-lan 'bash -lc "export PATH=/opt/homebrew/bin:\$PATH && openclaw cron list && openclaw cron runs --id 41288933-9aec-4b5a-a209-158421e53366"'

# 重启 Beacon（配置改动后）
ssh mac-lan 'launchctl unload ~/Library/LaunchAgents/ai.openclaw.gateway.plist && launchctl load ~/Library/LaunchAgents/ai.openclaw.gateway.plist'
```

日常交互：Telegram `@puregold_sandbox_bot`（只接 zsy666 一个 peer）。
