# 部署到华为云 ECS — 最详细指南

> 目标：把这个项目 100% 跑起来在你的华为云服务器上，含 HTTPS、备份、自动重启。
> 假设：你已经买了一台华为云 ECS（弹性云服务器）+ 弹性公网 IP（EIP）。

---

## ⚠ 部署前最容易踩的 5 个坑（先看一遍再开工）

1. **安全组默认拒绝**：华为云 ECS 的"安全组"默认只放行 22（SSH）。**80/443 必须手动开**，不开浏览器永远连不上。
2. **域名 + HTTPS**：本项目 NODE_ENV=production 时 cookie 带 `Secure` 标记，**没 HTTPS 就登不进去**（浏览器不回传 cookie）。所以**必须**配域名 + HTTPS，要么本地测试时把 NODE_ENV 改成 development。
3. **DNS 没生效就装 Caddy → 拿证书失败**：先 ping 域名确认解析到服务器 IP，再启 Caddy。
4. **2GB 内存 build 会 OOM**：Next.js + Prisma 构建吃内存。**建议 ECS 至少 2GB RAM**。1GB 的小机器需要先加 swap，或本地 build 完 push 镜像。
5. **Mac arm64 → 云 amd64 跨平台**：本地 Mac 的 Docker 镜像不能直接传到 x86 云服务器运行。**最简单办法：在服务器上 `git clone` + 本地 build**（推荐），不要 `docker save / docker load` 跨架构。

---

## 0. 服务器最低配置建议

| 项 | 建议值 | 说明 |
|---|---|---|
| vCPU | 1 核以上 | 一般够用 |
| 内存 | **2GB 起** | 1GB build Next.js 容易 OOM |
| 磁盘 | 40GB 起 | 系统 + 镜像 + 数据库 + 上传图片 |
| 操作系统 | **Ubuntu 22.04 LTS** | 这份指南基于 Ubuntu |
| 架构 | x86_64 | Kunpeng ARM 也行但镜像略不同 |
| 弹性公网 IP | 已绑定 | 否则没公网访问 |
| 带宽 | 1-3 Mbps 即可 | 自家用够了 |

---

## 1. 华为云控制台：配置安全组（关键！）

**位置**：登录华为云控制台 → 服务列表 → 计算 → 弹性云服务器 → 找到你的 ECS → 点击进入 → 左侧"安全组" → 配置规则。

**入方向规则**必须包含：

| 优先级 | 协议 | 端口范围 | 源地址 | 描述 |
|---|---|---|---|---|
| 1 | TCP | 22 | 你的家庭 IP/32 (推荐) 或 0.0.0.0/0 | SSH |
| 1 | TCP | 80 | 0.0.0.0/0 | HTTP（Caddy 拿证书需要） |
| 1 | TCP | 443 | 0.0.0.0/0 | HTTPS |
| 1 | ICMP | 全部 | 0.0.0.0/0 | 让你能 ping 通（可选） |

> ⚠ **不要**把 3000 端口开到公网。Next.js 的 3000 是给本机 Caddy 反向代理用的，外部直连会绕过 HTTPS。

应用规则后，等 1 分钟生效。

---

## 2. 准备好域名（HTTPS 必须）

### 2.1 你已经有域名

**位置**：进入你域名服务商（阿里云 / 腾讯云 / Cloudflare / GoDaddy 都行）的 DNS 控制台。

加一条 **A 记录**：

| 主机记录 | 类型 | 解析线路 | 记录值 | TTL |
|---|---|---|---|---|
| `scheduler` (或你想要的子域) | A | 默认 | 你的华为云 EIP | 600 |

例如：`scheduler.yourdomain.com` → `1.2.3.4`。

### 2.2 你没有域名

便宜的选项：
- **Cloudflare Registrar**：`.com` 约 $10/年，含免费 DNS
- **腾讯云 / 阿里云**：`.com` 约 ¥55/年，国内备案麻烦但解析快
- **`.xyz` / `.top`**：首年 ¥10，凑合用

> ⚠ **国内 ICP 备案**：如果买的是国内域名 + 国内服务器，**80/443 端口未备案会被拦**！这种情况：
> - **要么**买境外域名（不需备案）
> - **要么**先做 ICP 备案（华为云控制台有备案入口，2-4 周）
> - **要么**先用 IP + 自签证书（浏览器有红色警告，但能用）—— 不推荐

### 2.3 验证 DNS 生效

在你**自己的电脑**（不是服务器）上：

```bash
ping scheduler.yourdomain.com
# 应该返回你的 EIP

# 或用 dig 更明确：
dig +short scheduler.yourdomain.com A
```

DNS 通常 5-10 分钟生效。等到 ping 出正确 IP 再继续下一步。

---

## 3. 准备好 GitHub repo（推送代码用）

服务器拉代码最简单的办法是 git clone。所以你先要把代码推到 GitHub（私有 repo）。

### 3.1 建 GitHub 私有 repo

1. 去 https://github.com/new
2. Repository name: `scheduler`（随你）
3. **Private**（重要，否则代码公开）
4. 不要勾"Add README"（我们已经有了）
5. Create

### 3.2 在你本地 Mac 上 push

```bash
cd /Users/gongqipeng/Desktop/scheduler

# 看一眼有没有未提交的
git status

# 加 remote（替换成你刚建的 repo URL）
git remote add origin git@github.com:你的用户名/scheduler.git

# 第一次推
git branch -M main   # 把 master 改成 main（GitHub 默认）
# 或者你想保留 master 也行，下面命令对应改
git push -u origin main
```

如果是首次用 GitHub SSH，需要先配 SSH key：
```bash
ssh-keygen -t ed25519 -C "you@email.com"   # 一路回车
cat ~/.ssh/id_ed25519.pub
# 复制输出，去 GitHub Settings → SSH keys → 加进去
ssh -T git@github.com   # 测试
```

### 3.3 在服务器上 clone 时怎么认证？

服务器上拉私有 repo 也需要认证。最简单：

**方案 A（推荐）：在服务器生成 SSH key + 加到 GitHub**

```bash
# (在服务器上)
ssh-keygen -t ed25519 -C "huawei-cloud"   # 一路回车
cat ~/.ssh/id_ed25519.pub
# 复制，回 GitHub Settings → SSH keys → "New SSH key" → 标题写 "huawei-cloud" → 粘贴
ssh -T git@github.com   # 第一次会问 yes/no，输 yes
```

**方案 B：用 Personal Access Token + HTTPS**

```bash
# GitHub: Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token
# 勾上 "repo" 权限，复制 token

# 服务器 clone 时：
git clone https://你的token@github.com/你的用户名/scheduler.git
```

---

## 4. SSH 登录服务器 + 初始化

### 4.1 登录

```bash
# 你买 ECS 时设置的密码或私钥
ssh root@1.2.3.4
# 或如果是 Ubuntu 用户：
ssh ubuntu@1.2.3.4
```

> 第一次会让你 `yes`，正常。

### 4.2 设置时区为东八区

```bash
sudo timedatectl set-timezone Asia/Shanghai
date  # 验证：显示 CST 时间
```

### 4.3 更新系统

```bash
sudo apt update && sudo apt upgrade -y
```

### 4.4 装 Docker + Docker Compose（一键脚本）

```bash
# 官方一键脚本（最稳）
curl -fsSL https://get.docker.com | sudo sh

# 让普通用户能用 docker 不用 sudo（如果你不是 root）
sudo usermod -aG docker $USER
# 退出重连让 group 生效
exit
ssh ubuntu@1.2.3.4

# 验证
docker --version          # 应该 28.x+
docker compose version    # 应该 v2.x+
```

> **如果 `get.docker.com` 在国内访问慢**：用阿里云镜像源
> ```bash
> curl -fsSL https://get.docker.com | sudo sh -s docker --mirror Aliyun
> ```

### 4.5 装 git 和 sqlite（备份脚本要用）

```bash
sudo apt install -y git
# sqlite3 不用装在 host 上，已经在容器里
```

### 4.6 （仅 1GB 内存机器）加 swap

如果 `free -h` 显示 ≤ 1GB 内存：

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h   # 验证 swap 已加
```

---

## 5. 部署应用

### 5.1 拉代码

```bash
sudo mkdir -p /opt
sudo chown $USER /opt   # 让你能在 /opt 里写
cd /opt
git clone git@github.com:你的用户名/scheduler.git
cd scheduler
```

### 5.2 配置生产环境变量

```bash
cp .env.production.example .env.production
nano .env.production
```

默认内容应该够用（看一遍确认）：

```
DATABASE_URL=file:/data/scheduler.db
DATA_DIR=/data
NODE_ENV=production
TZ=Asia/Shanghai
PORT=3000
HOSTNAME=0.0.0.0
HOST_PORT=3000
```

> 如果你想把容器对外端口改成别的（比如 8080）：`HOST_PORT=8080`。后面 Caddy 配 `reverse_proxy localhost:8080`。

`Ctrl+O` 回车保存，`Ctrl+X` 退出 nano。

### 5.3 准备数据目录

```bash
mkdir -p prod-data backups
```

### 5.4 构建 + 启动（首次很慢，等 5-10 min）

```bash
docker compose up -d --build
```

> 进度条不动是正常的，pnpm install + next build 就是慢。耐心等。
> 显示 "Container scheduler-app  Started" 表示成功。

### 5.5 看日志确认 OK

```bash
docker compose logs -f app
```

应该看到：
```
▸ Running prisma migrate deploy...
4 migrations found in prisma/migrations
... (applied)
▸ Starting Next.js server on 0.0.0.0:3000...
  ▲ Next.js 15.x.x
  - Local:        http://localhost:3000
 ✓ Ready in 124ms
```

`Ctrl+C` 退出 logs 视图（容器仍在跑）。

### 5.6 服务器内部 smoke

```bash
curl -sI http://localhost:3000/
# 应该返回 HTTP/1.1 307 Temporary Redirect + Location: /login
```

### 5.7 创建首个管理员

```bash
docker compose exec app node node_modules/tsx/dist/cli.mjs scripts/seed-user.ts \
  --username yourname \
  --display "你的昵称" \
  --password "一个够长的密码" \
  --color "#5089C6" \
  --admin
```

应该输出 `✓ User "yourname" created/updated.`。

---

## 6. 装 Caddy 配 HTTPS（host 上跑，反向代理到容器）

### 6.1 装 Caddy

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

> 国内访问 cloudsmith.io 慢的话，用替代源（搜 "Caddy 离线安装包" 下 .deb 文件 + `dpkg -i`）。

### 6.2 写 Caddyfile

```bash
sudo nano /etc/caddy/Caddyfile
```

清空原内容，写：

```
scheduler.yourdomain.com {
    reverse_proxy localhost:3000
}
```

替换 `scheduler.yourdomain.com` 为你的真实域名。保存退出。

### 6.3 重启 Caddy

```bash
sudo systemctl restart caddy
sudo systemctl status caddy
# 应该显示 active (running)
```

### 6.4 看 Caddy 拿证书

```bash
sudo journalctl -u caddy -f
```

应该看到类似：
```
... obtain certificate for scheduler.yourdomain.com
... certificate obtained successfully
```

`Ctrl+C` 退出。

### 6.5 浏览器访问

打开 **https://scheduler.yourdomain.com** ✓ 锁标志显示。看到登录页 → 用 5.7 创建的账号登录。

---

## 7. 配置定时备份

### 7.1 试跑一次

```bash
cd /opt/scheduler
bash scripts/backup.sh
ls -lh backups/
```

应该产出 `scheduler-YYYYMMDD-HHMMSS.tar.gz`。

### 7.2 配 cron

```bash
crontab -e
```

加一行（凌晨 3 点跑）：

```
0 3 * * * cd /opt/scheduler && /usr/bin/bash scripts/backup.sh >> /var/log/scheduler-backup.log 2>&1
```

保存退出。验证：
```bash
crontab -l
```

> 备份保留 14 天（默认）。改 `RETENTION_DAYS` 环境变量可改。

### 7.3 （可选）异地备份到华为云 OBS

```bash
# 装 obsutil
wget https://obs-community.obs.cn-north-1.myhuaweicloud.com/obsutil/current/obsutil_linux_amd64.tar.gz
tar -xzf obsutil_linux_amd64.tar.gz
sudo mv obsutil_linux_amd64*/obsutil /usr/local/bin/

# 配 AK/SK（在华为云控制台 - 我的凭证 - 访问密钥）
obsutil config -i=AK -k=SK -e=obs.cn-north-1.myhuaweicloud.com

# 在 backup.sh 末尾加（或写新 cron）：
obsutil cp /opt/scheduler/backups/ obs://你的桶名/scheduler/ -r -f
```

---

## 8. 验证清单（部署完逐条勾）

- [ ] 浏览器打开 https://scheduler.yourdomain.com → 显示锁标志（HTTPS 通）
- [ ] 自动跳到 /login，看到登录页
- [ ] 用刚创建的 admin 账号能登录，进首页看到月历
- [ ] 顶部能看到"管理员"链接（admin 才有）
- [ ] /admin 能进，能创建第二个账号
- [ ] /tasks 建任务，回首页点任务+点格子，图标出现
- [ ] 点格子打开日详情，写一段心声 + 上传一张图，保存，重开 sheet 内容还在
- [ ] 切换到周历 / 时间轴 / `/u/<其他用户名>` 都能看
- [ ] 改 /settings 昵称 → 顶部 nav 立刻变
- [ ] 退出登录 → 用第二个账号登录 → 没"管理员"链接
- [ ] 试 `bash scripts/backup.sh` → backups/ 多了个 tar.gz
- [ ] `crontab -l` 显示备份 cron 已配

---

## 9. 日常维护命令一览

```bash
cd /opt/scheduler

# 看状态
docker compose ps

# 看日志（实时）
docker compose logs -f app

# 重启容器
docker compose restart app

# 停止
docker compose down

# 启动
docker compose up -d

# 升级（拉新代码 + 重 build）
git pull
docker compose up -d --build

# 容器内执行命令（比如 seed 新账号、看 DB）
docker compose exec app node node_modules/tsx/dist/cli.mjs scripts/seed-user.ts \
  --username someone --display "Some One" --password "pw123456" --color "#A8C256"

# 重置某人密码（兜底）
docker compose exec app node node_modules/tsx/dist/cli.mjs scripts/reset-password.ts \
  --username someone --password "newpw123456"

# 进容器看 SQLite
docker compose exec app sqlite3 /data/scheduler.db
# .tables
# SELECT * FROM User;
# .exit

# 手动备份
bash scripts/backup.sh

# 看备份
ls -lh backups/

# 恢复（如果数据丢了）
docker compose down
tar -xzf backups/scheduler-XXXXXXXX.tar.gz -C prod-data/
mv prod-data/scheduler-snap.db prod-data/scheduler.db
docker compose up -d
```

---

## 10. 故障排查

### 10.1 浏览器打开域名加载不出来

按顺序排查：

```bash
# 1. DNS 是否解析正确？
ping scheduler.yourdomain.com   # 应该回你的 EIP

# 2. 服务器上 Caddy 在跑吗？
sudo systemctl status caddy

# 3. Caddy 拿到证书了吗？
sudo journalctl -u caddy -n 50

# 4. 容器在跑吗？
cd /opt/scheduler && docker compose ps

# 5. 容器内部能响应吗？
curl -sI http://localhost:3000/

# 6. 80/443 安全组开了吗？
# 去华为云控制台再确认一遍
```

### 10.2 浏览器报 "ERR_CERT_AUTHORITY_INVALID" / "证书无效"

Caddy 拿证书失败。最常见原因：
- DNS 还没生效（等 5-10 min）
- 80 端口被防火墙拦（安全组 + ufw 都要检查）
- 域名还在备案期（国内域名 + 国内服务器场景）

```bash
# 检查 80 是否对外开放（在你本地 Mac 跑，不是服务器）
nc -zv scheduler.yourdomain.com 80
nc -zv scheduler.yourdomain.com 443
```

### 10.3 登录后立刻被踢回 login（cookie 不工作）

99% 是没走 HTTPS。Cookie 带 `Secure` 标记浏览器不传。

- 确认浏览器地址栏是 `https://`
- 确认 NODE_ENV=production（生产正确）
- 临时调试：`.env.production` 改 `NODE_ENV=development`（注意：cookie 没 Secure 不安全，调完改回去）

### 10.4 docker build 失败 "killed" / 突然中断

OOM。看：

```bash
free -h
```

如果 swap 是 0：回到 4.6 加 swap。或买大内存机器。

### 10.5 `docker compose exec` 报 "scheduler-app is not running"

容器挂了。看 logs：

```bash
docker compose logs --tail 100 app
```

最常见：`prisma migrate deploy` 失败（schema 与 DB 不一致 / volume 里有手改过的内容）。如果是干净环境第一次部署，不应该出这种问题。

### 10.6 镜像越拉越大 / 旧镜像占空间

```bash
# 看占用
docker system df

# 清旧镜像（不影响在跑的容器）
docker system prune -f
docker image prune -f
```

---

## 11. 升级流程（之后我改了代码）

**推荐**：一键脚本，自动做完"备份 → 拉代码 → 提醒迁移 → build → 健康检查"全套：

```bash
cd /opt/scheduler
bash scripts/deploy.sh
```

脚本会：
1. 检查环境（docker、env、git 干净）
2. 自动 `bash scripts/backup.sh` 备份当前 DB + uploads
3. `git fetch` + 列出新 commits
4. 如果有新 Prisma migrations，**显式列出**让你确认（5 秒可 Ctrl-C 中止）
5. `git pull --ff-only`
6. `docker compose up -d --build`
7. 轮询 `localhost:3000/` 健康检查（最多 60s）
8. 失败时打印**回滚命令**（不自动回滚，太危险）

正常输出（绿✓ + 黄!）你扫一眼就知道情况。

---

**手工模式**（如果你想精确控制每一步）：

```bash
cd /opt/scheduler
# 1. 先备份
bash scripts/backup.sh

# 2. 拉新代码
git fetch origin
git log HEAD..origin/master --oneline                # 看新增什么
git diff HEAD..origin/master -- prisma/migrations/   # 检查新 migration
git pull --ff-only

# 3. 重 build + 重启
docker compose up -d --build

# 4. 看日志确认 migrate + server 起来
docker compose logs -f app
```

Migration 在 entrypoint 自动跑 `prisma migrate deploy`（幂等、只前向），不用手动 `prisma migrate`。

**数据安全保证**：
- `prod-data/` 是 host 上的 volume，**重 build 不动它**。SQLite 文件 + uploads 都在那里
- Session 在 DB 里，升级后用户保持登录
- 至今所有 migration 都是"加表/加字段"（无 DROP/类型变更），无破坏性
- **未来某次升级如果引入破坏性 migration**，deploy.sh 会在 pull 前列出文件名让你看；你看到 `DROP` 之类的关键字就 Ctrl-C，先 review 再继续

---

## 12. 极端情况：服务器整个崩了怎么恢复

假设你有一台新服务器 + 最新一个备份 tar.gz。

```bash
# 1. 在新机器走完 §1-§4
# 2. clone repo 到 /opt/scheduler
# 3. cp .env.production.example .env.production
# 4. 把备份 tar.gz scp 到新机器
scp backups/scheduler-XXXX.tar.gz user@新IP:/opt/scheduler/
# 5. 解压到 prod-data
cd /opt/scheduler
mkdir -p prod-data
tar -xzf scheduler-XXXX.tar.gz -C prod-data/
mv prod-data/scheduler-snap.db prod-data/scheduler.db
# 6. 启动
docker compose up -d --build
# 7. 跑域名 DNS 改到新 IP
# 8. 新装 Caddy（§6）
# 9. 验证
```

---

## 附：本地开发 vs 生产差异表

| 项 | 本地 dev (`pnpm dev`) | 生产 docker (`docker compose up`) |
|---|---|---|
| NODE_ENV | development | production |
| Cookie Secure flag | 否 | 是（必须 HTTPS） |
| 数据库 | `data/scheduler.db` | `prod-data/scheduler.db`（容器内 `/data/scheduler.db`） |
| 上传 | `data/uploads/` | `prod-data/uploads/` |
| 端口 | 3000 | 3000（容器） + 443（Caddy 对外） |
| Migration | `pnpm db:migrate` 手动 | entrypoint 自动 |
| 重启策略 | `Ctrl+C` 手动 | `restart: unless-stopped` 自动 |

---

跑一遍这份指南最少需要 30-60 分钟（首次 docker build 占大头）。如果某一步卡住，**截屏发给我** + 跑当前命令的输出，我帮你定位。
