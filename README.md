# 日历记账

A self-hosted calendar-based task tracker for small circles (couple, family, close friends). **Feature-complete (Plan 6).** Includes admin console (`/admin`), week/timeline/profile views, daily notes with image upload, and production Docker deployment with automated SQLite backup.

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS 4
- Prisma 6 + SQLite
- bcryptjs for password hashing
- Vitest (unit + integration) + Playwright (E2E)

## Development

```bash
pnpm install
pnpm db:migrate                  # initialize SQLite
pnpm seed:user --username alice --display "Alice" --password "..." --color "#FF8888" [--admin]
pnpm dev                         # http://localhost:3000
```

## Testing

```bash
pnpm test                        # vitest unit + integration (167 tests, 15 files)
pnpm test:e2e                    # Playwright E2E (58 tests: auth + task CRUD + occurrence/month-view + daily-notes + settings + week-view + multiuser + admin; auto-spawns dev server, runs sequentially)
pnpm build                       # production build (type-check + bundle)
```

## CLI utilities

CLI is the fallback for first-deploy provisioning and emergency access. For normal day-to-day account management, use the `/admin` UI.

```bash
# Create or upsert a user (first-deploy + emergency fallback).
pnpm seed:user --username <u> --display "<d>" --password "<p>" --color "#hex" [--admin]

# Reset a user's password (also clears all their sessions).
pnpm seed:reset-password --username <u> --password "<new>"
```

## 部署到自有云服务器

### 一次性准备

```bash
# 1. 在服务器上拉代码
git clone <repo> /opt/scheduler
cd /opt/scheduler

# 2. 复制 env 模板（默认值适用大多数场景）
cp .env.production.example .env.production

# 3. 构建 + 启动
docker compose up -d --build

# 4. 创建首个管理员
docker compose exec app node node_modules/tsx/dist/cli.mjs scripts/seed-user.ts \
  --username yourname --display "Your Name" --password "..." \
  --color "#5089C6" --admin

# 5. 在反向代理（Nginx / Caddy）后挂 HTTPS
#    Caddyfile 示例：
#    your.domain.com {
#      reverse_proxy localhost:3000
#    }
```

> ⚠ NODE_ENV=production 时 session cookie 带 Secure flag，**必须走 HTTPS** 才能登录。本地 docker 测试可在 .env.production 临时改 NODE_ENV=development。

### 多平台构建（Mac → 云 amd64）

```bash
docker buildx build --platform linux/amd64 -t scheduler:latest .
# 或在云服务器上 git pull && docker compose up -d --build 直接本地 build
```

### 备份

每天 cron 跑 `scripts/backup.sh`，写到 `./backups/scheduler-YYYYMMDD-HHMMSS.tar.gz`，默认保留 14 天。

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
tar -xzf backups/scheduler-XXXXX.tar.gz -C prod-data/
mv prod-data/scheduler-snap.db prod-data/scheduler.db
docker compose up -d
```

### 升级

```bash
git pull
docker compose up -d --build
# Migration 在 entrypoint 自动跑
```

## Project structure

```
prisma/                # Prisma schema + migrations
Dockerfile             # multi-stage build (deps → builder → runner)
docker-compose.yml     # production compose (app + named volume)
docker/entrypoint.sh   # runs prisma migrate deploy then starts server
scripts/backup.sh      # SQLite hot-backup → tar.gz; retains 14 days
src/
  app/
    login/             # public login page
    (app)/             # auth-guarded route group
      page.tsx         # / home — month view with task panel + occurrence grid
      week/            # /week — 7-column week view; today highlighted; occurrence recording
      timeline/        # /timeline — merged view all users × days; private tasks filtered
      u/[username]/    # /u/<x> — readonly month view of another user's public tasks
      settings/        # /settings — displayName + color picker; revalidates layout on save
      tasks/           # /tasks — task list + create/edit form + archive/delete
      occurrences/     # server actions: addOccurrence, removeOccurrence, setCheck
      notes/           # server actions: upsertNote, deleteNoteImage, reorderNoteImages
      admin/           # /admin — admin-only user management: create/edit/reset-password/delete; three self-protections
      nav-bar.tsx      # top nav: links to all routes, active state, admin link (admins only), view-switcher dropdown
      note-editor.tsx  # textarea + image grid; readonly prop hides save/upload/delete
    api/
      login/           # POST /api/login
      logout/          # POST /api/logout
      uploads/         # POST /api/uploads (multipart upload), GET /api/uploads/[id] (serve image, auth-gated)
  lib/
    db.ts              # Prisma singleton (dev-HMR-safe)
    password.ts        # bcrypt wrappers
    session.ts         # session create/validate/destroy
    auth.ts            # getCurrentUser / requireAuth / requireAdmin / requireAuthApi
    task-validation.ts # validateTaskInput + 12-color palette + parseTaskFormData
    note-validation.ts # validateNoteContent / validateImageMeta; NOTE_IMAGES_MAX=6, NOTE_IMAGE_BYTES_MAX=5MB
    storage.ts         # buildUploadPath / saveUpload / readUpload / deleteNoteImageFromDisk / deleteUserUploadsDir
    user-validation.ts # validateUsername / validateDisplayName / validatePassword
    dates.ts           # formatDateKey (sv-SE), monthGrid, todayKey, weekRange, monthRange
    visibility.ts      # scopeTasksWhere / scopeOccurrencesWhere — privacy filter helpers
scripts/               # CLI utilities (seed-user, reset-password)
tests/
  unit/                # password, session, task-validation
  integration/         # login route, seed-user, task server-actions
  e2e/                 # auth + task CRUD + occurrence + notes + settings + week + multiuser
  helpers/             # test DB fixtures
docs/superpowers/      # design docs and execution plans
```

The dev DB (`dev-data/dev.db`) and test DB (`test-data/test.db`) carry seeded users including `e2e_alice` (password: `test_password_123`) created by the E2E global setup.

Uploaded images are stored at `${DATA_DIR}/uploads/<userId>/<YYYY-MM>/<uuid>.<ext>` where `DATA_DIR` defaults to `dev-data` (dev) or `test-data` (test). The `/api/uploads/[id]` route serves files directly from disk; unauthenticated requests receive a 401 JSON response.

## Roadmap

See `docs/superpowers/plans/` for execution plans:

- [x] Plan 1: Foundation + authentication (User, Session, login/logout)
- [x] Plan 2: Task CRUD — Prisma Task model, validation, server actions, `/tasks` UI (list, form, emoji picker, 12-color palette, archive/unarchive/delete)
- [x] Plan 3: Month view + occurrence recording — `/` is now month calendar with task panel; CHECK (idempotent toggle) + COUNTED (count badge accumulation); day detail sheet; delete guard blocks tasks with occurrences
- [x] Plan 4: Daily notes / 心声 — per-day text editor (10000 char cap) + image upload (6 images/day, 5 MB each, jpg/png/webp/gif); auth-gated image serve; transactional DB + disk rollback on failure
- [x] Plan 5: Views + multi-user — `/week` (7-column week calendar), `/timeline` (all users × days merged), `/u/<username>` (readonly profile view with 404 for missing users, self-redirect to `/`), `/settings` (displayName + color), privacy filter (`isPrivate` tasks hidden from non-owners), progress badges on COUNTED tasks, view-switcher dropdown in nav
- [x] Plan 5.5: Admin user management — `/admin` console (admin-only, redirects non-admins to `/`); create/edit/reset-password/delete users via UI; three self-protections (no delete-self, no demote-self, no remove-last-admin); reset password invalidates all sessions; delete cascades data and cleans uploads dir; admin nav link visible to admins only; CLI remains for first-deploy + emergency fallback
- [x] Plan 6: Docker deployment + backup — multi-stage Dockerfile (Next.js standalone), docker-compose.yml, entrypoint auto-runs migrations, `scripts/backup.sh` (SQLite hot-backup → tar.gz, 14-day retention). **Project feature-complete.**

For full product specification, see `specifications.md`.
