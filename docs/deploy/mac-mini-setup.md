# Mac mini Sandbox 部署清单

把 `develop` 分支跑成一个 Mac mini 上对外可访问的 dev sandbox。**这是 dev sandbox，不是生产环境**——数据可丢、不存真实 PII。生产环境是另一回事，走付费云。

走完这份清单大约 1-2 小时（不算等域名 DNS 生效和 build）。

---

## 阶段 1｜域名

**当前使用的域名**：`puregoldclassictranslation.com`（Cloudflare Registrar 注册，DNS 已在 Cloudflare 托管）

- Sandbox 主机名：`dev.puregoldclassictranslation.com`
- apex（`puregoldclassictranslation.com` 本身）暂时保留，未来给生产环境

**不需要**自己配 A 记录、CNAME 之类的——后面 `cloudflared tunnel route dns` 会自动帮你建。

> 如果以后要换域名或者新加一个：必须用 Cloudflare Registrar 注册，或者把现有域名的 nameserver 转到 Cloudflare（免费 plan 就够）。Cloudflare Tunnel 强依赖 Cloudflare 管 DNS。

---

## 阶段 2｜Mac mini 基础环境

### 2.1 安装 Docker Desktop

- 下载：[docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/)（选 Apple Silicon 版本）
- 安装、首次启动、接受条款（**不需要**登录 Docker Hub 账号）
- Settings → Resources → Memory：建议 4 GB 以上
- Settings → General → Start Docker Desktop when you sign in：勾上（开机自启）

### 2.2 装其他工具

```bash
# Homebrew（如果还没装）
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# git 通常 macOS 自带，没装的话：
xcode-select --install

# Cloudflare Tunnel 客户端
brew install cloudflared
```

### 2.3 把代码拉下来

```bash
mkdir -p ~/srv && cd ~/srv

# 用 SSH（推荐）。先确保 Mac mini 上的 SSH key 已加到 GitHub。
git clone git@github.com:puregold-classic/volunteer-tracker.git
# 或用 HTTPS + GitHub PAT
# git clone https://github.com/puregold-classic/volunteer-tracker.git

cd volunteer-tracker
git checkout develop
git pull
```

---

## 阶段 3｜首次启动整套

### 3.1 准备 .env.deploy

```bash
cd ~/srv/volunteer-tracker
cp .env.deploy.example .env.deploy
```

生成强随机密钥：

```bash
echo "POSTGRES_PASSWORD=$(openssl rand -hex 32)"
echo "JWT_SECRET=$(openssl rand -hex 32)"
```

把这两行 + 你自己的 admin 信息填进 `.env.deploy`。最终大概长这样（**不要**用下面的占位密钥，自己生成）：

```bash
POSTGRES_PASSWORD=<openssl rand -hex 32 的输出>
JWT_SECRET=<openssl rand -hex 32 的输出>
JWT_EXPIRES_IN=8h
BCRYPT_SALT_ROUNDS=10

# 这条暂时留空，要等阶段 4 拿到域名后再填
CORS_ALLOWED_ORIGINS=

BOOTSTRAP_ADMIN_EMAIL=你的邮箱@example.com
BOOTSTRAP_ADMIN_PASSWORD=至少 8 位的强密码
BOOTSTRAP_ADMIN_NAME=你的名字
```

> `.env.deploy` 已经在 `.gitignore` 里，不会被提交。**永远不要**把它推到任何地方。

### 3.2 启动

```bash
docker compose --env-file .env.deploy -f docker-compose.deploy.yml up -d --build
```

第一次会比较慢（拉镜像 + npm ci + vite build + prisma generate），耐心等。

### 3.3 验证

```bash
# 容器状态：三个都应该 Up，backend 和 postgres 应该是 healthy
docker compose --env-file .env.deploy -f docker-compose.deploy.yml ps

# 健康检查应该返回 ok 且 postgresql: connected
curl http://localhost/api/health

# 看 backend 启动日志，确认 bootstrap 创建了 admin
docker compose --env-file .env.deploy -f docker-compose.deploy.yml logs backend | grep -E "bootstrap|migration"
# 应该看到 3 条 migration apply（最后一个是 v2.1 schema reset）：
#   Applying migration `20260308223201_init`
#   Applying migration `20260308223223_add_partial_unique_nps`
#   Applying migration `20260408183915_schema_v2_1`
#   [bootstrap] created initial admin account: 你的邮箱@example.com (id=...)
```

打开浏览器访问 `http://localhost`，用 `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` 登录，能进就 OK。

> 此时只能 Mac mini 本机访问，外面看不到。下一阶段把它接到公网。

---

## 阶段 4｜Cloudflare Tunnel 接入

### 4.1 登录 + 创建 tunnel

```bash
cloudflared tunnel login
# 浏览器会打开，选择你在阶段 1 注册的域名授权
# 凭证会写到 ~/.cloudflared/cert.pem

cloudflared tunnel create vt-sandbox
# 输出会包含一行像：
#   Created tunnel vt-sandbox with id 12345678-abcd-...
# 记住这个 tunnel ID，下面要用
```

### 4.2 写 tunnel 配置

把 `<TUNNEL_ID>` 和 `<你的域名>` 替换成你的实际值，写到 `~/.cloudflared/config.yml`：

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /Users/<你的mac用户名>/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: dev.puregoldclassictranslation.com
    service: http://localhost:80
  - service: http_status:404
```

### 4.3 绑定 DNS

```bash
cloudflared tunnel route dns vt-sandbox dev.puregoldclassictranslation.com
# 这条命令会在 Cloudflare 自动创建一个 CNAME 指向 tunnel
```

### 4.4 把域名加进 backend CORS 允许列表

编辑 `~/srv/volunteer-tracker/.env.deploy`，把刚才空着的 `CORS_ALLOWED_ORIGINS` 填上：

```bash
CORS_ALLOWED_ORIGINS=https://dev.puregoldclassictranslation.com
```

让 backend 重读环境变量：

```bash
cd ~/srv/volunteer-tracker
docker compose --env-file .env.deploy -f docker-compose.deploy.yml up -d
```

### 4.5 前台跑一次 tunnel 看日志

```bash
cloudflared tunnel run vt-sandbox
```

看到 `Connection registered` 之类的字样就说明通了。**用手机关 WiFi 走 4G** 访问 `https://dev.puregoldclassictranslation.com`，应该能看到登录页。试着登录一次（这一步会触发 CORS preflight，要确认能成功）。

如果没问题，Ctrl+C 停掉前台 tunnel，下一步装成系统服务。

### 4.6 装成开机自启的系统服务

```bash
sudo cloudflared service install
```

这会创建 `/Library/LaunchDaemons/com.cloudflare.cloudflared.plist`。**但 brew cloudflared 2026.x 在 macOS 上的 `service install` 有两个坑必须手动修**，否则服务起来后只会在日志里反复打印 `Use 'cloudflared tunnel run' to start tunnel ...` 然后 KeepAlive 死循环重启：

**坑 1：config 没拷到系统位置。** launchd 以 root 跑，看不到 `~/.cloudflared/`。手动拷一份到 `/etc/cloudflared/`，并把 config 里的 `credentials-file` 路径同步改掉：

```bash
sudo bash -c '
TUNNEL_ID=<从前面 cloudflared tunnel create 的输出抄过来>
mkdir -p /etc/cloudflared
cp ~/.cloudflared/config.yml /etc/cloudflared/config.yml
cp ~/.cloudflared/${TUNNEL_ID}.json /etc/cloudflared/${TUNNEL_ID}.json
sed -i "" "s|/Users/$(whoami)/.cloudflared/|/etc/cloudflared/|g" /etc/cloudflared/config.yml
chmod 600 /etc/cloudflared/${TUNNEL_ID}.json
chown root:wheel /etc/cloudflared/*
'
```

> 如果上面的 sudo bash heredoc 在你的 shell 里被吞了 `~`，把 `~/.cloudflared/` 替换成绝对路径 `/Users/<你的mac用户名>/.cloudflared/`。

**坑 2：plist 的 `ProgramArguments` 只有二进制路径，没有 `tunnel run` 子命令。** 用 PlistBuddy 加上：

```bash
sudo /usr/libexec/PlistBuddy \
  -c "Add :ProgramArguments:1 string tunnel" \
  -c "Add :ProgramArguments:2 string run" \
  /Library/LaunchDaemons/com.cloudflare.cloudflared.plist

sudo launchctl bootout system /Library/LaunchDaemons/com.cloudflare.cloudflared.plist 2>/dev/null
sudo launchctl bootstrap system /Library/LaunchDaemons/com.cloudflare.cloudflared.plist
```

验证服务跑起来 + tunnel 真的连了边缘：

```bash
sudo launchctl list | grep cloudflared
# 应该看到非空 PID，第二列是 0（exit 0 = 正常运行中）

tail /Library/Logs/com.cloudflare.cloudflared.err.log
# 应该看到 4 条 "Registered tunnel connection ... protocol=quic"
# 不应该看到 "Use 'cloudflared tunnel run' to start tunnel..."
```

### 4.7 装 tunnel watchdog（**强烈建议**）

cloudflared 有个 launchd `KeepAlive` 抓不到的盲区：进程活着但跟 edge 的 4 条连接全断了，对外就 HTTP 530 / err 1033。已经踩过一次 11 小时没人发现，所以装一个端到端的健康探测 daemon：每 2 分钟 curl 一次公网 URL，连续 2 次失败就 `launchctl kickstart -k` 把 cloudflared 硬重启。

脚本和 plist 模板已经在 repo 里：

```bash
cd ~/srv/volunteer-tracker  # 假设这是你 Mac mini 上的 PROJECT_ROOT

# 把 plist 模板里的 {{PROJECT_ROOT}} 替换成绝对路径，写到系统 LaunchDaemons
sudo sed "s|{{PROJECT_ROOT}}|$(pwd)|g" \
  scripts/deploy/com.volunteer-tracker.tunnel-watchdog.plist.template \
  | sudo tee /Library/LaunchDaemons/com.volunteer-tracker.tunnel-watchdog.plist > /dev/null

sudo chown root:wheel /Library/LaunchDaemons/com.volunteer-tracker.tunnel-watchdog.plist
sudo chmod 644 /Library/LaunchDaemons/com.volunteer-tracker.tunnel-watchdog.plist

# bootstrap 加载到 launchd（RunAtLoad=true，会立即跑一次）
sudo launchctl bootstrap system /Library/LaunchDaemons/com.volunteer-tracker.tunnel-watchdog.plist
```

验证：

```bash
# 1. plist 已注册（PID 应该是非 0 数字或 -，第二列应该是 0）
sudo launchctl list | grep volunteer-tracker.tunnel-watchdog

# 2. 立即跑了一次健康检查（probe ok 时啥都不打印；只在状态变化时写一行）
ls -la /Library/Logs/volunteer-tracker-tunnel-watchdog.log

# 3. 手动跑一次脚本看输出 + 日志
sudo /bin/bash scripts/deploy/tunnel-watchdog.sh && \
  tail /Library/Logs/volunteer-tracker-tunnel-watchdog.log

# 4. 故障注入测试（**会让公网短暂不可达 10-30s**）：手动让 cloudflared 假死，
#    把 connection 全断掉，等 watchdog 检测 → kickstart → 恢复。
#    最简单的办法是直接 stop 然后立即 sleep 5 min 再观察恢复曲线。
sudo launchctl kill SIGSTOP system/com.cloudflare.cloudflared
# 等约 4-5 分钟（2 min 探测 × 2 次失败阈值 + 重启时间），看公网恢复
curl -sS -o /dev/null -w "HTTP %{http_code}\n" https://dev.puregoldclassictranslation.com/
# watchdog 这条 kickstart 不会救活被 STOP 住的进程，需要手动 CONT
sudo launchctl kill SIGCONT system/com.cloudflare.cloudflared  # 收尾
```

> **注意**：watchdog 用 `launchctl kickstart -k` 强重启 cloudflared，被 SIGSTOP 暂停的场景救不了；真实故障（连接断开、客户端 bug、process hang）都能救。要更完整的故障注入，可以临时把 cloudflared 进程 kill 掉看 launchd 自己拉起 vs watchdog 介入的时序。

调参：编辑 `/Library/LaunchDaemons/com.volunteer-tracker.tunnel-watchdog.plist` 改 `StartInterval`（探测间隔），或者改 `EnvironmentVariables` 加 `FAILURE_THRESHOLD` / `PROBE_URL` 等环境变量。改完要 `bootout` + `bootstrap` 重新加载。

---

## 操作参考

```bash
cd ~/srv/volunteer-tracker

# 看日志（替换 backend 为 frontend / postgres 看其他服务）
docker compose --env-file .env.deploy -f docker-compose.deploy.yml logs -f backend

# 重启单个服务
docker compose --env-file .env.deploy -f docker-compose.deploy.yml restart backend

# 停掉所有容器但保留数据
docker compose --env-file .env.deploy -f docker-compose.deploy.yml down

# 停掉并清空所有数据（慎用，会删 postgres volume！）
docker compose --env-file .env.deploy -f docker-compose.deploy.yml down -v
```

### 更新代码（手动部署）

```bash
cd ~/srv/volunteer-tracker
git pull
docker compose --env-file .env.deploy -f docker-compose.deploy.yml up -d --build
```

`up -d --build` 会重建有变化的镜像并替换运行中的容器，几十秒短暂下线。Sandbox 可以接受。

---

## Troubleshooting

| 症状 | 排查 |
|---|---|
| `compose up` 报 `XXX is required` | `.env.deploy` 没填某个必需 env，对照 `.env.deploy.example` |
| `migrate deploy` 失败 | 看 `docker compose logs postgres`，通常是密码不一致或 postgres 没起来 |
| `[bootstrap]` 没出现在日志里 | 检查 `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` 是否正确传入 backend |
| 浏览器能打开页面但登录报 `CORS not allowed` | `CORS_ALLOWED_ORIGINS` 没填、值不对、或者改完没 `up -d` 重启 backend |
| `https://dev.puregoldclassictranslation.com` 在外网打不开但 `localhost` 能 | (1) `cloudflared tunnel route dns` 没跑过 (2) tunnel 服务没在跑（`sudo launchctl list \| grep cloudflared`）(3) DNS 还没生效，等几分钟 |
| Cloudflare 显示 `Error 1033` | tunnel 进程没在跑或没真连到边缘。看 `/Library/Logs/com.cloudflare.cloudflared.err.log`：如果在反复打印 `Use 'cloudflared tunnel run' to start tunnel ...`，说明阶段 4.6 的 plist `ProgramArguments` 没改对，回去补 |
| 想重置 admin 密码 | 直接 `docker compose ... down -v` 清空，调整 `.env.deploy` 里的 `BOOTSTRAP_ADMIN_PASSWORD`，重新 up——记住这会清掉所有数据，sandbox 模式可以接受 |
