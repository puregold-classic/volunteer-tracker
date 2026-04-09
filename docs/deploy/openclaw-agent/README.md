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
           [外部监控: UptimeRobot (未来)]
                    │
                    │ 告警 → Telegram sendMessage
                    ▼
        [Telegram bot @puregold_sandbox_bot]
                    │
                    │ outbound long-poll
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

**硬隔离在哪里**：
- **Channel 层**：`dmPolicy: allowlist` + `allowFrom: [<TELEGRAM_USER_ID>]`，只有 zsy666 一个 peer 能对话，其它消息直接 drop
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

## 当前状态（2026-04-09 22:00 EDT）

- **Beacon 已部署并通过毕业测试**：`launchctl unload` 注入 cloudflared 故障 → Beacon 诊断 + self-correct + 恢复公网 200 + 写 repair log，全程 ~10 秒无人工介入
- **watchdog 并存过渡期**：双保险运行。约定 1 周稳定运行 + 至少经手 3 次真实 cloudflared 故障 → 退役 watchdog（删 `scripts/deploy/tunnel-watchdog.sh` + plist + launchd unload）
- **UptimeRobot 外部监控**：尚未接入（下一阶段工作）
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
