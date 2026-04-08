# PostgreSQL 备份策略 — Mac mini sandbox

写于 2026-04-08，配套 v2.1 数据库定型。本策略针对 Mac mini sandbox（`docker-compose.deploy.yml` 跑的那套），不直接覆盖未来付费 prod。Prod 上线前需要重新评估（见末尾）。

## TL;DR

- **每日 03:00** launchd 触发 `scripts/deploy/pg-backup.sh`
- 通过 `docker exec ... pg_dump` 把整个 `volunteer_tracker` 数据库 dump 成 `.sql.gz`
- 存到 `data/backups/`（已 gitignore），命名 `volunteer_tracker-YYYYMMDD-HHMMSS.sql.gz`
- 自动轮转：保留最近 **30 天**，更老的删除
- 灾难恢复：`scripts/deploy/pg-restore.sh latest` 一行命令回滚（restore 前会自动 dump 一份"pre-restore"安全网）

## 为什么这么设计

| 决定 | 理由 |
|---|---|
| `pg_dump` 而非 `pg_basebackup`/WAL archiving | sandbox 单机、数据量小、一致性恢复点对小团队足够。WAL 增量是 prod 的事 |
| 通过 `docker exec` 进容器 dump | 不需要在 Mac 主机装 libpq 客户端，零依赖 |
| `--clean --if-exists --no-owner` | dump 自带 `DROP TABLE IF EXISTS`，restore 时不用先 drop database。`--no-owner` 避免恢复到不同 user 时报权限错 |
| 存在 `data/backups/` 而非容器 volume | bind-mount 到 host，备份不会跟着 `docker compose down -v` 被清掉 |
| launchd 而非 cron | macOS 推荐方式。开机休眠后会在下一次 wake 时补跑 |
| 30 天保留 | 30 个 `.sql.gz`（当前 sandbox 数据 < 1MB/dump）= 几十 MB，完全 OK |

## 文件清单

```
scripts/deploy/
├── pg-backup.sh                                  # 备份脚本（idempotent，可手动跑）
├── pg-restore.sh                                 # 恢复脚本（destructive，要敲 RESTORE 确认）
└── com.volunteer-tracker.pg-backup.plist.template # launchd 模板（{{PROJECT_ROOT}} 占位）

data/backups/                                     # 备份产物（gitignore）

docs/deploy/backup-strategy.md                    # 本文档

Makefile                                          # 包含 backup / restore 目标
```

## 安装到 Mac mini（一次性）

```bash
ssh mac
cd ~/srv/volunteer-tracker

# 1. 拉新代码（如果还没拉）
git pull origin develop

# 2. 渲染 launchd plist 模板（替换 {{PROJECT_ROOT}}）
sed "s|{{PROJECT_ROOT}}|$HOME/srv/volunteer-tracker|g" \
  scripts/deploy/com.volunteer-tracker.pg-backup.plist.template \
  > ~/Library/LaunchAgents/com.volunteer-tracker.pg-backup.plist

# 3. 加载到 launchd（开机自启）
launchctl load -w ~/Library/LaunchAgents/com.volunteer-tracker.pg-backup.plist

# 4. 验证 launchd 看见了
launchctl list | grep volunteer-tracker
# 期望输出类似:
#   -    0    com.volunteer-tracker.pg-backup
# (PID 列是 - 因为现在没在跑，状态 0 表示上次退出码 0 / 还没跑过)

# 5. 立即手动触发一次（不等 03:00）
launchctl start com.volunteer-tracker.pg-backup
sleep 5

# 6. 看日志
tail /tmp/volunteer-tracker-pg-backup.out.log
tail /tmp/volunteer-tracker-pg-backup.err.log

# 7. 看产物
ls -lh ~/srv/volunteer-tracker/data/backups/
```

## 日常使用

### 手动跑一次备份

```bash
# Mac mini 上
cd ~/srv/volunteer-tracker
./scripts/deploy/pg-backup.sh

# 或通过 Makefile
make backup
```

### 列出现有备份

```bash
ls -lht data/backups/
```

### 恢复到某个备份

```bash
# 恢复最新的
./scripts/deploy/pg-restore.sh latest

# 或指定文件
./scripts/deploy/pg-restore.sh data/backups/volunteer_tracker-20260408-120000.sql.gz

# 会先打一个 "pre-restore" 安全网，然后 drop+recreate database，最后 pipe in
# 恢复完成后会打印 safety net 文件路径，万一搞砸了可以回滚
```

### 调整保留天数

```bash
# 临时
RETAIN_DAYS=60 ./scripts/deploy/pg-backup.sh

# 永久：改 launchd plist 加 EnvironmentVariables 里的 RETAIN_DAYS
```

### 卸载 launchd 任务

```bash
launchctl unload ~/Library/LaunchAgents/com.volunteer-tracker.pg-backup.plist
rm ~/Library/LaunchAgents/com.volunteer-tracker.pg-backup.plist
```

## 演练记录

| 日期 | 操作 | 结果 | 备注 |
|---|---|---|---|
| 2026-04-08 | 首次手动 backup | ✓ 6.0KB dump，含 v2.1 schema + 全部 seed 数据 | — |
| 2026-04-08 | 首次 restore 演练 | ❌ → ✓ | 第 1 次失败：DROP DATABASE 被 backend pool 挡住。改用 `WITH (FORCE)` 修复 |
| 2026-04-08 | 第 2 次 restore 演练 | ✓ | 10/50/4/5/2 行精确还原。但 backend 502，因 Prisma pool 被强杀 |
| 2026-04-08 | restore 后 backend 自动 restart | ✓ | 加进 pg-restore.sh 末尾。SKIP_BACKEND_RESTART=1 可跳过 |
| 2026-04-08 | launchd 装载 + 手动 trigger | ✓ | `launchctl start com.volunteer-tracker.pg-backup` → 新 dump 生成，stderr 干净 |

每次重要 schema 变更后，**应当跑一次 restore 演练**（用 sandbox 当 staging），确保 dump 真的能恢复。

每次重要 schema 变更后，**应当跑一次 restore 演练**（用 sandbox 当 staging），确保 dump 真的能恢复。

## 这个策略不覆盖的事 + 未来 prod 时要做的

| 缺口 | 现在为什么 OK | prod 时要补 |
|---|---|---|
| 没有 off-host 备份 | sandbox 数据可丢，30 个本地 dump 够用 | 加 S3 / R2 / Backblaze 同步 |
| 没有 PITR (point-in-time recovery) | sandbox RPO ≈ 1 天（足够） | 启用 WAL archiving + base backup |
| 没有加密静态文件 | sandbox 数据没真实 PII | 用 GPG 加密 dump 或者依赖加密文件系统 |
| 没有自动恢复演练 | 手动按需就行 | 定期自动 restore 到 staging 验证 |
| 备份脚本运行错误没告警 | tail 日志手动检查 | 接通知（邮件/钉钉/Slack）on launchd 失败 |
| 数据库越权访问 | sandbox 内部网络 | prod 必须用 SSL + IP 白名单 + 强密码 + auditing |

## 故障排查

### `pg-backup.sh` 报 `container 'volunteer-tracker-deploy-postgres-1' is not running`

`docker compose --env-file .env.deploy -f docker-compose.deploy.yml up -d` 起一下 stack。

### launchd 加载失败 `Operation not permitted`

macOS 可能需要在「系统设置 → 隐私与安全 → 完整磁盘访问」里允许 `launchd` 或终端访问相关目录。或者用 `sudo launchctl` 不可能，因为这是 user agent 不是 system daemon——故意的，避免 root 权限。

### 备份文件 0 字节

脚本会自动检测 < 200 字节的 dump 并删除 + 退出码 3。看 stderr 日志找原因（最常见：`pg_dump` 在容器里报错，可能是权限或网络）。

### 想看 dump 内容里有什么（不解压全部）

```bash
gunzip -c data/backups/volunteer_tracker-XXX.sql.gz | head -50
```

### 把某个 dump 拷到 WSL 本地分析

```bash
# 在 WSL 里
scp mac:~/srv/volunteer-tracker/data/backups/volunteer_tracker-20260408-120000.sql.gz /tmp/
```
