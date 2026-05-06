# 日历记账 — Plan 6: Docker 部署 + 备份脚本

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** 把项目打包成可部署到云服务器的 Docker 镜像，配 docker-compose 简化运维，加备份脚本和 README 部署文档。完成后 `git clone && docker compose up -d`（再 seed 一个 admin）就能上线。

**Architecture:**
- Next.js `output: "standalone"` 减小镜像
- 多阶段 Dockerfile：
  - **deps**：装依赖 + 生成 Prisma client
  - **builder**：next build → standalone
  - **runner**：最小镜像，只跑 server
- Entrypoint：`prisma migrate deploy` + 启动
- docker-compose：单服务（`app`），挂载 `./data:/data` volume，env 文件 `.env.production`
- 备份脚本：用 `sqlite3 .backup` 做原子快照 + tar 打包 uploads，cron 调度

**Tech Stack:** Node 24 (LTS) Alpine 镜像；Prisma 自动检测 `linux-musl` 引擎；不引新 npm 依赖

---

## ⚠ 实施前的关键坑点

### 镜像构建

1. **`output: "standalone"`** 必须在 next.config.ts 加。否则镜像里得带整个 `node_modules`，臃肿。
2. **Prisma client 与 standalone**：`next build --output=standalone` 不会自动复制 `node_modules/.prisma` 和 `node_modules/@prisma/client`。需要 Dockerfile 显式 COPY。
3. **`public/` 与 `.next/static/`** 同样不会自动进 standalone，需要手动 COPY。
4. **Alpine + Prisma**：Prisma 需要 `linux-musl-openssl-3.0.x` engine。Alpine 自带 OpenSSL 3。Prisma 6 的 binaries 默认会下 musl 版本，没问题；如果遇到运行时报错 missing engine，方案是 `apk add --no-cache openssl libc6-compat` 或换 `node:24-slim`。
5. **`pnpm install --frozen-lockfile`** 保证 lockfile 一致；CI 友好。
6. **构建上下文**：`.dockerignore` 必须列 `node_modules / .next / data / test-data / .env / playwright-report / test-results / *.tsbuildinfo / .git`，否则 build 慢且把不该进的拷进去。
7. **多平台**：用户在 Mac (arm64) 构建但部署到云（多半 amd64）。**MVP 只构建本机 arch**；上线时如果云是 x86，需 `docker buildx build --platform linux/amd64`，README 写明。

### 启动 / 迁移

8. **Migration at startup**：用 `prisma migrate deploy`（生产用，幂等，不交互）。entrypoint 脚本里先跑 migrate 再启动 server。
9. **Migration 失败应该让容器启动失败**：`set -e` 让 entrypoint 在 migrate 失败时退出，docker restart policy 会反复重启，运维能看到。
10. **首个 admin 的 seed**：**不能**自动 seed（密码不能硬编码）。README 说明：`docker compose exec app pnpm seed:user --admin ...` 手动建。
11. **Prisma client 在容器里**：standalone 输出里 require 路径硬编码。如果 COPY 路径不对，运行时报错 "Cannot find module @prisma/client"。

### 数据 / Volume

12. **DATA_DIR 在容器里**：`/data`（绝对路径）。
13. **DATABASE_URL**：`file:/data/scheduler.db`（绝对路径，Prisma 默认相对 `prisma/schema.prisma` 解析，绝对路径覆盖之）。
14. **Volume 权限**：Alpine 容器默认以 root 跑（除非显式 USER）。如果改成非 root（推荐），需 chown 数据目录。**MVP 简化**：root 跑（自部署小圈子，可接受）；后续优化加 USER。
15. **首次启动空 volume**：`prisma migrate deploy` 会自动建 SQLite 文件 + 应用所有 migration。空目录 OK。

### Env vars

16. **`.env.production`** 模板（不进 git）：
    ```
    DATABASE_URL=file:/data/scheduler.db
    DATA_DIR=/data
    NODE_ENV=production
    TZ=Asia/Shanghai
    PORT=3000
    ```
17. **NODE_ENV=production** 时 cookie `Secure` flag 自动开（Plan 1 写的逻辑）→ **必须走 HTTPS** 才能登录！README 写明配反向代理（Nginx/Caddy）+ Let's Encrypt。
18. **如果开发想本地 docker 测但没 HTTPS**：临时 NODE_ENV=development（cookie 不带 Secure）。但其他逻辑可能有差异，少做。

### 备份

19. **SQLite 在线备份**：直接 `cp scheduler.db` 不安全（事务进行中可能拷到不一致状态）。**正解**：`sqlite3 /data/scheduler.db ".backup /tmp/snap.db"`。原子快照。
20. **uploads/ 拷贝**：tar 即可（图片是不可变的，没并发写问题）。
21. **备份脚本路径**：放在 `scripts/backup.sh`，进容器执行 OR host 上调用 `docker exec`。**MVP**：host 脚本通过 `docker compose exec` 调用容器内 sqlite3 + tar。
22. **保留策略**：保留最近 14 天，cron 跑前删旧。
23. **alpine 没有 sqlite3 CLI**：默认装的是 `node-prisma-engine`，没 `sqlite3` binary。需要 `apk add sqlite` 或在 Dockerfile 装。否则备份脚本里没法跑 `.backup`。装上。
24. **备份目录权限**：host 上的 `./backups/` 目录用户能读写。

### 测试

25. **本地 docker 跑通**：`docker compose build && docker compose up -d` → 确认能 curl http://localhost:3000 → 307 /login → seed 一个 admin → 能登录 → 简单跑下 /tasks。
26. **不在 CI 里测 docker** —— 自部署项目，本地手动 smoke 即可。E2E 还是跑在 dev server 上。
27. **跑 docker 时不要污染 dev DB**：docker 用 `./data:/data` volume，dev 用 `./data/scheduler.db`。**冲突！**两个会用同一个文件。**解决**：docker volume 改成 `./prod-data:/data`（区分），dev 仍用 `./data/`。

### 易遗漏

28. **`output: "standalone"` 要 export server.js**：standalone 模式 `node .next/standalone/server.js` 启动。CMD 用这个。
29. **`PORT` env**：Next.js standalone 会读 `PORT`，默认 3000。
30. **`HOSTNAME=0.0.0.0`**：standalone 默认绑 localhost，容器内 OK 但 docker 端口映射要它绑 0.0.0.0。设 `HOSTNAME=0.0.0.0` env。
31. **健康检查**：docker-compose `healthcheck` 加一条 `curl localhost:3000/login`，restart 策略更智能。**MVP 跳过**，restart: unless-stopped 够用。
32. **logs**：Next.js 写 stdout → docker 自动捕获。`docker compose logs -f app` 看日志。
33. **gitignore prod-data 和 backups**：避免大文件进 repo。

---

## 文件结构

```
Dockerfile
docker-compose.yml
.dockerignore
.env.production.example                # 模板
docker/
  entrypoint.sh                        # migrate deploy + 启动
scripts/
  backup.sh                            # SQLite 快照 + tar uploads
README.md                              # 加部署 + 备份章节
next.config.ts                         # 加 output: "standalone"
```

---

### Task 1: next.config.ts 加 standalone + 本地验证

#### Step 1.1

修改 `next.config.ts`：
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
};

export default nextConfig;
```

#### Step 1.2: 本地构建验证

```bash
pnpm build 2>&1 | tail -20
```
确认生成 `.next/standalone/` 目录。

```bash
ls .next/standalone/  # 应该有 server.js 和精简的 node_modules
```

#### Step 1.3: 本地启动 standalone 跑一遍

> 注意：standalone 服务器需要 `PORT` env，而且会从 `.env` 读 DATABASE_URL。需要 prisma client 在 standalone node_modules 里。

```bash
# 先确认 prisma client 在 standalone 里 — 大概率不在
ls .next/standalone/node_modules/.prisma 2>/dev/null || echo "缺 .prisma"
ls .next/standalone/node_modules/@prisma/client 2>/dev/null || echo "缺 @prisma/client"
```

> 如果缺：这个问题在 Docker 里显式 COPY 解决。本地这步只验证 .next/standalone/ 存在 + server.js 存在即可，不必本地真跑 standalone。

#### Step 1.4: tests 还是绿
```bash
pnpm test 2>&1 | tail -3
pnpm test:e2e 2>&1 | tail -3  # 不必跑，太慢；除非 next.config.ts 改影响 E2E
```

#### Step 1.5: 提交

```bash
git add next.config.ts
git commit -m "feat: enable Next.js standalone output for Docker"
```

---

### Task 2: Dockerfile + .dockerignore

**Dockerfile**：

```dockerfile
# syntax=docker/dockerfile:1.6

# ──── deps stage ───────────────────────────────────────────────
FROM node:24-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

# ──── builder stage ────────────────────────────────────────────
FROM node:24-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable && pnpm exec prisma generate
RUN pnpm exec next build

# ──── runner stage ────────────────────────────────────────────
FROM node:24-alpine AS runner
RUN apk add --no-cache libc6-compat openssl sqlite tini
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATA_DIR=/data
ENV DATABASE_URL=file:/data/scheduler.db
ENV TZ=Asia/Shanghai

# Standalone 输出（不含 prisma client）
COPY --from=builder /app/.next/standalone ./
# 公共资源 + 静态 assets
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static

# Prisma：runtime 需要 client + engine + migrations
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma

# CLI 脚本（首次部署 / 兜底用）
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src/lib/password.ts ./src/lib/password.ts
# (注意：scripts/seed-user.ts 用 tsx 跑，需要 tsx 在 node_modules 里。standalone 不带 tsx。
#  解决：在 deps 阶段把 tsx 装进 prod 也保留 → 单独 COPY)
COPY --from=deps /app/node_modules/tsx ./node_modules/tsx

# Entrypoint
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Volume mount target
RUN mkdir -p /data

EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--", "/entrypoint.sh"]
CMD ["node", "server.js"]
```

**`docker/entrypoint.sh`**：

```bash
#!/bin/sh
set -e

echo "▸ Running prisma migrate deploy..."
node node_modules/.bin/prisma migrate deploy

echo "▸ Starting Next.js server on $HOSTNAME:$PORT..."
exec "$@"
```

> 注意：standalone 模式下 `node_modules/.bin/prisma` 不一定存在。改用 `pnpm exec` 不行（standalone 没 pnpm）。**正解**：在 deps 阶段额外保留 prisma CLI binary：

调整 Dockerfile runner，加：

```dockerfile
COPY --from=deps /app/node_modules/prisma ./node_modules/prisma
COPY --from=deps /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
```

或者更简单：用 `npx prisma migrate deploy` —— npx 是 Node 自带，但需要联网拉 prisma。生产环境不要联网装东西，**显式 COPY 是更稳的方式**。

**`.dockerignore`**：

```
node_modules
.next
out
dist
*.log
.env
.env*.local
.env.production
data/
prod-data/
backups/
test-data/
playwright-report/
test-results/
.playwright-mcp/
*.tsbuildinfo
*.png
.DS_Store
.git
.github
docs/
*.md
!README.md
tests/e2e/
tests/integration/
tests/unit/
tests/helpers/
.vscode
.idea
```

> 注意：tests/ 在 builder 阶段不需要（next build 不打包它们）。但如果要在 prod 跑 E2E（不需要），就别 ignore。MVP ignore。

#### Step 2.1: 写 Dockerfile + entrypoint + .dockerignore

#### Step 2.2: build

```bash
docker compose build app 2>&1 | tail -30
# OR
docker build -t scheduler:test . 2>&1 | tail -30
```

确认 build 成功。检查镜像大小：
```bash
docker images scheduler:test
# 期望 ~ 200-400 MB
```

#### Step 2.3: 提交

```bash
git add Dockerfile .dockerignore docker/entrypoint.sh
git commit -m "feat: add Dockerfile + entrypoint for production deployment"
```

---

### Task 3: docker-compose.yml + .env.production.example

**`docker-compose.yml`**：

```yaml
services:
  app:
    build:
      context: .
    container_name: scheduler-app
    restart: unless-stopped
    env_file:
      - .env.production
    ports:
      - "${HOST_PORT:-3000}:3000"
    volumes:
      - ./prod-data:/data
```

**`.env.production.example`**：

```
# Production env. Copy to .env.production and adjust.
DATABASE_URL=file:/data/scheduler.db
DATA_DIR=/data
NODE_ENV=production
TZ=Asia/Shanghai
PORT=3000
HOSTNAME=0.0.0.0
HOST_PORT=3000
```

#### Step 3.1: 写文件

#### Step 3.2: 本地启动

```bash
cp .env.production.example .env.production
mkdir -p prod-data
docker compose up -d
docker compose ps
docker compose logs -f app  # 看 migrate 是否成功 + server 起来
# Ctrl+C 退出 logs（容器仍运行）
```

#### Step 3.3: smoke

```bash
curl -sI http://localhost:3000/  # 应该 307 /login
curl -s http://localhost:3000/login | head -10
```

#### Step 3.4: seed 一个 admin in container

```bash
docker compose exec app sh -c "node node_modules/tsx/dist/cli.mjs scripts/seed-user.ts \
  --username docker_admin --display 'Docker Admin' --password 'docker_admin_pw' \
  --color '#5089C6' --admin"
```

> tsx CLI 的入口位置可能不同，可能是 `node_modules/.bin/tsx` 或 `node_modules/tsx/dist/cli.mjs`。**用 `pnpm seed:user` 在容器里不可行**（没 pnpm）。所以 entrypoint/CMD 只支持 `node ...` 直跑。
>
> **改方案**：写一个 `node_modules/.bin/tsx` symlink in image，或者在 image 里加 pnpm，或者写一个不依赖 tsx 的 JS seed 脚本。**最简单**：保留 tsx，用 absolute path。

具体路径需要在 image 里 `docker compose exec app ls node_modules/.bin/` 看一眼确认。

#### Step 3.5: 登录验证

```bash
curl -si -X POST -d "username=docker_admin&password=docker_admin_pw" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  http://localhost:3000/api/login
```

期望 302 + Set-Cookie。

> **HTTPS 警告**：NODE_ENV=production 时 cookie 加 `Secure` flag。本地通过 http 测会拿到 cookie 但浏览器可能不发回去。curl 不受影响，能继续测。如果浏览器测，**临时**改 NODE_ENV=development 或加反向代理。

#### Step 3.6: 关停 + 提交

```bash
docker compose down
git add docker-compose.yml .env.production.example
git commit -m "feat: add docker-compose.yml + production env template"
```

---

### Task 4: 备份脚本

**`scripts/backup.sh`**（host 上跑）：

```bash
#!/bin/bash
set -euo pipefail

# 配置
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
COMPOSE_SERVICE="${COMPOSE_SERVICE:-app}"

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
ARCHIVE="$BACKUP_DIR/scheduler-${TIMESTAMP}.tar.gz"

echo "▸ Snapshotting SQLite..."
docker compose exec -T "$COMPOSE_SERVICE" sh -c \
  'sqlite3 /data/scheduler.db ".backup /tmp/snap.db" && cat /tmp/snap.db' \
  > "$BACKUP_DIR/.snap-${TIMESTAMP}.db"

echo "▸ Tarring snapshot + uploads..."
tar -czf "$ARCHIVE" \
  -C "$BACKUP_DIR" ".snap-${TIMESTAMP}.db" \
  -C "$(pwd)/prod-data" "uploads"

# Or: combine via docker exec to access uploads directly
# Actually simpler: prod-data is local on host, just tar it directly
# But snap.db is in container. Strategy: pipe snap.db out, then tar locally.

rm -f "$BACKUP_DIR/.snap-${TIMESTAMP}.db"

echo "▸ Cleaning backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name 'scheduler-*.tar.gz' -mtime +"$RETENTION_DAYS" -delete

echo "✓ Backup written to $ARCHIVE"
ls -lh "$ARCHIVE"
```

> 注：上面 tar 那行命令脚本有点纠结（snap.db 在 host，uploads 也在 host 上的 prod-data）。**简化**：直接 host 上 tar 整个 prod-data 文件夹（DB + uploads）+ 用 sqlite3 backup 替代裸文件拷贝。

清晰版：

```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
DATA_DIR_HOST="${DATA_DIR_HOST:-./prod-data}"
COMPOSE_SERVICE="${COMPOSE_SERVICE:-app}"

mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# 1. SQLite 原子快照（在容器内执行，写到 host 挂载的 volume 路径）
echo "▸ Creating SQLite snapshot..."
docker compose exec -T "$COMPOSE_SERVICE" \
  sqlite3 /data/scheduler.db ".backup /data/scheduler-snap.db"

# 2. 打包整个 prod-data（含 snap.db + uploads + 原始 db；原始 db 不重要了，但留着没坏处）
ARCHIVE="$BACKUP_DIR/scheduler-${TIMESTAMP}.tar.gz"
echo "▸ Creating archive: $ARCHIVE"
tar -czf "$ARCHIVE" \
  -C "$DATA_DIR_HOST" \
  scheduler-snap.db \
  uploads

# 3. 清理临时 snap
rm -f "$DATA_DIR_HOST/scheduler-snap.db"

# 4. 保留策略
echo "▸ Cleaning backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name 'scheduler-*.tar.gz' -mtime +"$RETENTION_DAYS" -delete

echo "✓ $ARCHIVE"
ls -lh "$ARCHIVE"
```

#### Step 4.1: 写脚本 + chmod +x

#### Step 4.2: 本地试跑（容器需要在跑）

```bash
docker compose up -d
sleep 5
bash scripts/backup.sh
ls backups/
docker compose down
```

确认产生 `scheduler-YYYYMMDD-HHMMSS.tar.gz`，能 `tar -tzvf` 看到 scheduler-snap.db 和 uploads/。

#### Step 4.3: 提交

```bash
git add scripts/backup.sh
chmod +x scripts/backup.sh  # 确保有执行权
git commit -m "feat: add SQLite-safe backup script (sqlite3 .backup + tar)"
```

---

### Task 5: README 部署 + 备份章节

修改 README 加：

#### 部署到自有云服务器

```markdown
## 部署到自有云服务器

### 一次性准备

```bash
# 1. 在服务器上拉代码
git clone <repo> /opt/scheduler
cd /opt/scheduler

# 2. 复制 env 模板并按需调整（默认值适用）
cp .env.production.example .env.production

# 3. 构建 + 启动
docker compose up -d --build

# 4. 创建首个管理员
docker compose exec app node node_modules/.bin/tsx scripts/seed-user.ts \
  --username yourname --display "Your Name" --password "..." \
  --color "#5089C6" --admin

# 5. 在反向代理（Nginx / Caddy）后挂 HTTPS
#    Caddyfile 示例：
#    your.domain.com {
#      reverse_proxy localhost:3000
#    }
```

> ⚠ NODE_ENV=production 时 session cookie 带 Secure flag，**必须走 HTTPS** 才能登录。本地 docker 测试可临时改 NODE_ENV=development。

### 多平台构建（Mac → 云 amd64）

```bash
docker buildx build --platform linux/amd64 -t scheduler:latest .
# 或在云服务器上 git pull && docker compose up -d --build 直接本地 build
```

### 备份

每天 cron 跑 `scripts/backup.sh`，写到 `./backups/scheduler-YYYYMMDD-HHMMSS.tar.gz`，保留 14 天。

```bash
# 试跑一次
bash scripts/backup.sh

# Crontab：每天凌晨 3 点
crontab -e
# 0 3 * * * cd /opt/scheduler && /usr/bin/bash scripts/backup.sh >> /var/log/scheduler-backup.log 2>&1
```

### 恢复

```bash
docker compose down
tar -xzf backups/scheduler-XXXX.tar.gz -C prod-data/
mv prod-data/scheduler-snap.db prod-data/scheduler.db
docker compose up -d
```

### 升级

```bash
git pull
docker compose up -d --build
# Migration 在 entrypoint 自动跑
```
```

#### Step 5.1: 写 README 修改

#### Step 5.2: 提交

```bash
git add README.md
git commit -m "docs: add deployment + backup instructions for self-hosting"
```

---

### Task 6: 全量回归 + Plan 6 收官

- vitest 167 全绿（next.config 改不影响测试）
- e2e 58 全绿（dev mode 跑，与 docker 无关）
- `pnpm build` 干净 + 生成 standalone
- docker compose up → curl smoke 通
- backup 脚本能跑出 .tar.gz
- 更新 README "至此 Plan 1-6 完成"

提交：`docs: mark Plan 6 complete + project ready for self-host`

---

## Plan 6 验收清单

- [ ] `pnpm test` 全绿
- [ ] `pnpm test:e2e` 全绿
- [ ] `pnpm build` 干净 + .next/standalone 生成
- [ ] `docker compose build` 成功
- [ ] `docker compose up -d` 容器运行
- [ ] curl http://localhost:3000/ → 307 /login
- [ ] seed admin in container → 能登录
- [ ] backup script 产生有效 tar.gz（含 snap db + uploads）
- [ ] README 部署 / 备份 / 升级章节齐全

通过 = 项目可上线。
