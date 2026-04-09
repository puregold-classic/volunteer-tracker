# OpenClaw Mac mini Lifeline — Deploy Playbook

> **角色**：zsy666 主刀 install，Claude Code 出素材（本文件 + `context-mac-mini.md` + `incident-2026-04-09.md`）
> **前提**：Mac mini 健康可访问（LAN 或 Tailscale），GLM API key 有效（⚠️ 见下 **blocker**），Telegram bot 已建
> **终极目标**：Mac mini 上跑一个 OpenClaw agent，作为 ssh 之外的第二条恢复通道

---

## ✅ GLM 端点 & 计费 — 已解决

**正确路径**：`https://api.z.ai/api/anthropic/v1/messages`（Anthropic-shape，**不是** OpenAI-compatible `/api/paas/v4/chat/completions`）。

**为什么**：zsy666 的 Pro 额度属于 "GLM Coding Plan"，只在 `/api/anthropic` 端点计费。走 `/api/paas/v4/chat/completions` 会走按量付费 bucket 返回 `1113 Insufficient balance`。

**2026-04-09 19:05 验证**：用 zsy666 给的 key 对 6 个 model 各打一次 `/v1/messages`，**全部返回真实 content**：

| Model | 结果 |
|---|---|
| `GLM-4.7` | ✅（Coding Plan default Opus 映射）|
| `GLM-4.5-Air` | ✅（Coding Plan default Haiku 映射）|
| `glm-5.1` / `GLM-5.1` | ✅（200K ctx）|
| `glm-5` | ✅ |
| `glm-5-turbo` | ✅ |

OpenClaw config 里对应的 api shape 是 **`"api": "anthropic-messages"`**（不是 `openai-completions`），这跟 zsy666 本机 `.openclaw/openclaw.json` 里 minimax-portal provider 的 config 模式完全一致，可对照写。

---

## 🔐 密钥清单（填入下面的 config，完成后删或 chmod 600 本文件）

| 名称 | 值 | 来源 |
|---|---|---|
| Telegram bot token | `<TELEGRAM_BOT_TOKEN>` | @BotFather，bot username `@puregold_sandbox_bot` |
| zsy666 Telegram user ID | `<TELEGRAM_USER_ID>` | @userinfobot |
| GLM API key | `<GLM_API_KEY>` | bigmodel.cn，命名 `mac-mini-openclaw-lifeline` |
| GLM base URL | `https://api.z.ai/api/anthropic` | **Coding Plan 专用端点**，Anthropic-shape。走 `/paas/v4/*` 会回 1113 因为那是按量付费 bucket |
| GLM API shape | `anthropic-messages` | 对应 `/v1/messages` 接口。**不是** `openai-completions` |
| GLM 模型（优先级递减） | `glm-5-turbo` / `glm-5.1` / `glm-5` | 2026-04-09 真实 API 调用验证通过 |

---

## Phase 0 — 前置健康检查（跑一次，确认 Mac mini OK）

```bash
# 从 WSL 这边
ssh mac-lan 'uptime && /usr/local/bin/docker ps --format "{{.Names}}\t{{.Status}}" && curl -s -o /dev/null -w "public %{http_code}\n" --max-time 8 https://dev.puregoldclassictranslation.com/api/health'
```

期望：uptime 正常、3 个 container 全 `Up ... (healthy)`、public 200。如果 public 不是 200 等 watchdog 自愈或手动 kickstart cloudflared 再继续。

---

## Phase 1 — 装 node@22 + OpenClaw（Mac mini 上跑）

```bash
ssh mac-lan

# 1. 启用 brew（Mac mini 的 brew 在 /opt/homebrew 但不在默认 PATH）
eval "$(/opt/homebrew/bin/brew shellenv)"

# 2. 装 node@22（OpenClaw 依赖）
brew install node@22

# 3. 把 node@22 加入 PATH（install.sh 会用）
export PATH="$(brew --prefix node@22)/bin:$PATH"
node -v    # 期望 v22.x
npm -v

# 4. 跑官方 installer（non-interactive，~3 min）
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --no-prompt --no-onboard

# 5. 验证
openclaw --version
ls ~/.openclaw/
```

**如果有问题**：installer 输出会告诉你原因。常见坑是 PATH 没带 node@22 — 重新 export 再跑。如果要回滚：`npm uninstall -g openclaw && rm -rf ~/.openclaw`

---

## Phase 2 — 写 config（`~/.openclaw/openclaw.json`）

**注意**：OpenClaw 装完后会生成默认 `openclaw.json`，我们要**替换**它。config 是 JSON 格式，schema 参照 WSL 本机 `~/.openclaw/openclaw.json` 和 `~/.openclaw-v2/openclaw.json`（zsy666 现有 instance）。

把下面内容保存为 `~/.openclaw/openclaw.json`（覆盖默认版本），然后 `chmod 600 ~/.openclaw/openclaw.json`：

```json
{
  "meta": {
    "role": "mac-mini-lifeline",
    "createdBy": "zsy666",
    "createdAt": "2026-04-09"
  },
  "models": {
    "providers": {
      "glm": {
        "baseUrl": "https://api.z.ai/api/anthropic",
        "apiKey": "<GLM_API_KEY>",
        "api": "anthropic-messages",
        "models": [
          {
            "id": "glm-5-turbo",
            "name": "GLM-5 Turbo",
            "reasoning": true,
            "contextWindow": 200000,
            "maxTokens": 131072
          },
          {
            "id": "glm-5.1",
            "name": "GLM-5.1",
            "reasoning": true,
            "contextWindow": 200000,
            "maxTokens": 131072
          },
          {
            "id": "glm-5",
            "name": "GLM-5",
            "reasoning": false,
            "contextWindow": 200000,
            "maxTokens": 131072
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "glm/glm-5-turbo",
        "fallbacks": [
          "glm/glm-5.1",
          "glm/glm-5"
        ]
      },
      "workspace": "/Users/zsy666/.openclaw/workspace",
      "heartbeat": {
        "every": "0"
      },
      "maxConcurrent": 2
    },
    "list": [
      {
        "id": "lifeline",
        "default": true,
        "name": "Mac mini Lifeline",
        "model": "glm/glm-5-turbo",
        "tools": {
          "allow": [
            "read",
            "exec",
            "sessions_send"
          ]
        }
      }
    ]
  },
  "tools": {
    "profile": "coding",
    "exec": {
      "security": "full",
      "ask": "off"
    }
  },
  "channels": {
    "telegram": {
      "enabled": true,
      "botToken": "<TELEGRAM_BOT_TOKEN>",
      "dmPolicy": "allowlist",
      "allowFrom": [
        "<TELEGRAM_USER_ID>"
      ],
      "groupPolicy": "deny",
      "streaming": "partial"
    }
  },
  "session": {
    "dmScope": "per-channel-peer",
    "threadBindings": {
      "enabled": true,
      "idleHours": 24,
      "maxAgeHours": 0
    }
  },
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "session-memory": {
          "enabled": true
        }
      }
    }
  },
  "gateway": {
    "port": 18790,
    "mode": "local",
    "bind": "loopback"
  },
  "plugins": {
    "allow": [
      "telegram"
    ],
    "entries": {
      "telegram": {
        "enabled": true
      }
    }
  }
}
```

**Schema 注意点**：
- `heartbeat.every: "0"` —— 禁用自动心跳，按你之前说的"层次 1 only"（被动响应，不主动 polling）
- `dmPolicy: "allowlist"` + `allowFrom: ["<TELEGRAM_USER_ID>"]` —— 硬隔离，只有你一个人能对话。这是 gateway 层硬路由，不是内容层软路由
- `groupPolicy: "deny"` —— bot 不响应 group 消息（UptimeRobot webhook 到 DM 即可）
- `exec.security: "full"` + `ask: "off"` —— 按你的 harness 原则，agent 执行命令不需要每次都问。边界靠 sudoers + context 文档
- **我没有**写 `models[].cost` 字段 —— 你说用量不是问题，跳过计费追踪
- **gateway.port 18790** —— 避开你 WSL 本机 `.openclaw` 的 18789

**schema 校验不过怎么办**：OpenClaw 启动时会报错，`openclaw --version` 出信息让你看哪个字段错。先用 `openclaw configure --dry-run` 跑一下（如果有这个 flag）。跑不通就对照 `~/.openclaw-v2/openclaw.json` 补/改字段。

---

## Phase 3 — 装 sudoers（Mac mini 上，需要 sudo）

```bash
ssh mac-lan

# 用 visudo 写，避免语法错把 sudoers 搞坏
sudo visudo -f /etc/sudoers.d/openclaw-agent
```

内容：

```
# OpenClaw lifeline agent — broad tools + hard boundaries
# Created 2026-04-09 by zsy666
#
# Philosophy: give agent the mechanism + why, not the recipe.
# Context doc at ~/.openclaw/skills/mac-mini-lifeline/context.md explains each tool.

# Cmnd aliases
Cmnd_Alias LIFELINE_LAUNCHCTL = /bin/launchctl, /usr/bin/launchctl
Cmnd_Alias LIFELINE_DOCKER = /usr/local/bin/docker, /opt/homebrew/bin/docker
Cmnd_Alias LIFELINE_BREW_SVC = /opt/homebrew/bin/brew services *
Cmnd_Alias LIFELINE_LOGS_READ = /usr/bin/cat /Library/Logs/*, /usr/bin/tail /Library/Logs/*, /usr/bin/head /Library/Logs/*
Cmnd_Alias LIFELINE_PMSET_READ = /usr/bin/pmset -g, /usr/bin/pmset -g *

# Hard deny list — mechanism: these destroy data or break lifeline channels beyond repair
Cmnd_Alias LIFELINE_DENY = \
    /usr/bin/pmset -a *, \
    /usr/bin/pmset -b *, \
    /usr/bin/pmset -c *, \
    /sbin/dd *, \
    /sbin/fdisk *, \
    /usr/sbin/diskutil eraseDisk *, \
    /opt/homebrew/bin/brew uninstall *, \
    /usr/local/bin/brew uninstall *

# Grant: broad tools, NOPASSWD (agent has no TTY)
zsy666 ALL=(ALL) NOPASSWD: LIFELINE_LAUNCHCTL, LIFELINE_DOCKER, LIFELINE_BREW_SVC, LIFELINE_LOGS_READ, LIFELINE_PMSET_READ

# Deny: hard boundary, even if some future rule grants broader access
zsy666 ALL=(ALL) !LIFELINE_DENY
```

**重要**：
- `visudo -f` 会在保存时自动 syntax check，如果有语法错**不会**覆盖旧文件，安全
- 写完后测一下：`sudo -n launchctl list | head -5` —— 如果不提示密码就通过了
- **严禁**把 `ALL` 给 NOPASSWD，那样就没边界了

---

## Phase 4 — ⏭️ **跳过 skill 自动注入**（按 zsy666 要求，手动调教）

agent 的"大脑"内容（`context-mac-mini.md` + `incident-2026-04-09.md`）**不在本 playbook 自动装进去**。你的意图是部署完 agent 跑起来之后，手动跟它对话，一步步喂给它需要的 context / skill / memory。这跟你"我来主刀调教"的说法一致。

这两份文档仍然留在 `.local-notes/openclaw-mac-mini/` 供你手动调教时参考：
- `context-mac-mini.md` — Mac mini 拓扑、故障模式、权限边界、repair log 规范、最终约束（按 harness 原则：机制 + 原理 + 风险 + 目标，不给食谱）
- `incident-2026-04-09.md` — 今天事故的完整 post-mortem，适合作为第一批"真实故障"示例喂给 agent

部署完之后你可以：
1. Telegram 对 agent 说 "我会 paste 一份你的操作手册到这个对话，读完记到长期记忆里"
2. 把 `context-mac-mini.md` 分段 paste 进去
3. 观察它怎么理解、哪里跑偏、哪里需要补充
4. 之后再喂 `incident-2026-04-09.md` 作为第一个真实故障样本

这样**你**在"调教" agent 的过程中会发现 context 文档哪里写得不准确，比我单方面写更贴合实际使用。

---

## Phase 5 — 作为 user launchd agent 启动 OpenClaw

```bash
ssh mac-lan

mkdir -p ~/Library/LaunchAgents
cat > ~/Library/LaunchAgents/ai.openclaw.lifeline.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>ai.openclaw.lifeline</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Users/zsy666/.openclaw/bin/openclaw-wrapper.sh</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
        <key>Crashed</key>
        <true/>
    </dict>
    <key>ThrottleInterval</key>
    <integer>60</integer>
    <key>StandardOutPath</key>
    <string>/Users/zsy666/.openclaw/logs/stdout.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/zsy666/.openclaw/logs/stderr.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
        <key>HOME</key>
        <string>/Users/zsy666</string>
    </dict>
</dict>
</plist>
EOF

# 启动脚本 wrapper — 保证 PATH / 工作目录正确
cat > ~/.openclaw/bin/openclaw-wrapper.sh << 'EOF'
#!/bin/bash
set -e
export PATH="/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$HOME"
exec openclaw start --mode daemon
EOF
mkdir -p ~/.openclaw/bin ~/.openclaw/logs
chmod +x ~/.openclaw/bin/openclaw-wrapper.sh

# 加载 + 启动
launchctl unload ~/Library/LaunchAgents/ai.openclaw.lifeline.plist 2>/dev/null || true
launchctl load ~/Library/LaunchAgents/ai.openclaw.lifeline.plist
launchctl list | grep openclaw

# 验证启动
sleep 5
tail -30 ~/.openclaw/logs/stdout.log
tail -30 ~/.openclaw/logs/stderr.log
```

**关于 `openclaw start --mode daemon`**：我不确定这是不是正确的 CLI 调用，你手头的 `.openclaw` / `.openclaw-v2` 里应该有现成的启动方式，**以你的为准**。我给的 plist 结构是标准 user launch agent 样板，ProgramArguments 指向你的 wrapper 脚本即可。

---

## Phase 6 — 冒烟测试（在 Telegram 里）

1. 打开 Telegram，搜 `@puregold_sandbox_bot`，点 Start
2. 发一条 `Hi`
3. 期望 agent 回应。如果没回应：
   - 检查 `~/.openclaw/logs/stderr.log` 看是不是 telegram 连接失败（token 错？allowFrom 没生效？）
   - 检查 `launchctl list | grep openclaw` —— `-` 表示没跑，数字表示 exit code
4. 如果 agent 回应但没"自我介绍"，手动对它说：「读一下你的 context 文档 `~/.openclaw/skills/mac-mini-lifeline/context.md`，然后告诉我你的职责是什么」
5. 期望它总结出：lifeline agent、终极目标是保持公网 200、关键工具是 launchctl kickstart cloudflared 等

---

## Phase 7 — 毕业测试（真实故障注入）

**前提**：① billing blocker 解决（GLM API 能跑通最小 chat completion） ② 冒烟测试通过 ③ **你已经手动把 `context-mac-mini.md` 喂给 agent** 并观察它至少能背出"终极目标是保持公网 200" + "首选动作是 kickstart cloudflared" ④ agent 能跑 `sudo launchctl` 且没有 password prompt 错误。

```bash
# 从 WSL 这边，手动把 cloudflared 踢死
ssh mac 'sudo launchctl unload /Library/LaunchDaemons/com.cloudflare.cloudflared.plist'

# 确认公网坏了
curl -s -o /dev/null -w "%{http_code}\n" --max-time 5 https://dev.puregoldclassictranslation.com/api/health
# 期望 530 或 000
```

**然后**：你在 Telegram 对 `@puregold_sandbox_bot` 说：「dev 站点打不开，看一下」

**期望**（按你喂给它的 context 的详尽程度，步数不同；这里是最理想情况）：
1. Agent curl 公网 → 看到 530
2. Agent curl localhost:80 → 看到 200（或者诊断方向正确）
3. Agent 读 cloudflared 日志或进程状态 → 发现 tunnel 没在跑
4. Agent 决定 `sudo launchctl load /Library/LaunchDaemons/com.cloudflare.cloudflared.plist`（或 `kickstart`）
5. Agent 等 ~30 秒再 curl 公网 → 200
6. Agent 在 Telegram 回复「我做了 X，现在恢复到 Y」

**验证通过** = 它自主完成 1-6 不需要你任何中间提示。  
**注**：repair log 是 context 文档里的约定，如果你手动调教时强调过"每次动手要写 log"它应该会写；如果没强调，第一次可能不写 —— 这是"调教不足"不是"毕业失败"。

**验证失败** = 它卡在某一步。这时候：
- 读 OpenClaw 的对话历史，看它推理到哪里断了
- 读 stderr.log 看有没有工具调用失败
- 读 sudo 日志 (`/var/log/sudo.log` on macOS，或 `sudoreplay`) 看 sudoers 是不是挡了
- 根据故障点调整 context 文档或 sudoers 或 config，重启 agent 再试

---

## Phase 8 — watchdog 退役决策

毕业测试通过 **并且** 稳定运行 1 周（期间至少经历 3 次真实 cloudflared 抖动、agent 全部自愈）→ 可以退役 watchdog：

```bash
ssh mac
sudo launchctl unload /Library/LaunchDaemons/com.volunteer-tracker.tunnel-watchdog.plist
sudo rm /Library/LaunchDaemons/com.volunteer-tracker.tunnel-watchdog.plist
# git 这边从 scripts/deploy/ 删 tunnel-watchdog.sh + plist template，develop 分支提交
```

在那一天之前，**两者并存**。watchdog 继续无脑 kickstart（每 2 分钟），agent 做更聪明的事（读日志推理、处理非 kickstart-可解的故障、记录 repair log 收敛知识）。

---

## 善后 — deploy 完成后

1. `rm /home/zsy666/dev/volunteer-tracker/.local-notes/openclaw-mac-mini/deploy-plan.md` 或至少 `chmod 600`（有密钥）
2. Mac mini 上 `chmod 600 ~/.openclaw/openclaw.json`（有 bot token + GLM key）
3. 告诉 Claude Code（me）：毕业测试结果，我会把今天的事故 + 架构决策写成 project memory 归档
4. 考虑把**脱敏版**的 context-mac-mini.md + deploy-plan.md commit 到 `docs/deploy/openclaw-agent/`（方便你将来复用 / 改其它 sandbox 装第二只）。脱敏 = 把 bot token / GLM key / user ID 换成 `<PLACEHOLDER>`

---

## 我不能替你判断的事

1. **OpenClaw 的 CLI 启动命令**（`openclaw start --mode daemon` 是我猜的，以你手头的 `.openclaw` 为准）
2. **Skill manifest 格式**（`~/.openclaw/skills/mac-mini-lifeline/` 要不要 `skill.json` 或 `package.json` 我不确定，参考 `~/.openclaw/skills/agent-self-improvement/` 结构）
3. **Telegram dmPolicy 字段的确切 enum**（`allowlist` 是我按 v1 discord 的类推，v2 telegram 用的是 `pairing`；如果 `allowlist` 不工作，用 `pairing` + 首次互动时完成配对）
4. **GLM 的 model ID 是不是真的是 `glm-5-turbo`** — 你说的"glm-5-turbo / glm-5.1 / glm-5"可能是产品名，真实 API model ID 要到 bigmodel.cn 控制台确认

这些是我给你的素材里**必须你来校准**的地方。遇到这几个点就参考本机 `~/.openclaw/openclaw.json` 或去 OpenClaw / GLM 官方文档。

---

## 需要我补什么？

跑下来任何一步报错、任何 schema 不对、任何 agent 行为跟预期不符 —— 回来告诉我报错信息或症状，我会调整 context 文档或 config 再给你下一版。

这是第一版，不是最终版。
