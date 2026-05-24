#!/bin/bash
# Safe one-shot deploy / upgrade for the scheduler app.
#
# Strategy:
#   1. Pre-flight checks (docker, repo, env file, no local changes)
#   2. Backup live DB + uploads (if data exists)
#   3. Show new commits + flag new Prisma migrations for human review
#   4. git pull --ff-only
#   5. Rebuild image + restart container
#   6. Health-check (poll up to 60s)
#   7. On failure: print rollback command (NO auto-rollback — too risky)
#
# Usage:
#   bash scripts/deploy.sh
#   bash scripts/deploy.sh --skip-backup     # if backup is known-broken

set -euo pipefail

# ── Args ──────────────────────────────────────────────────────────
SKIP_BACKUP=0
for arg in "$@"; do
  case "$arg" in
    --skip-backup) SKIP_BACKUP=1 ;;
    -h|--help)
      sed -n '2,17p' "$0"
      exit 0
      ;;
    *) echo "Unknown arg: $arg" >&2; exit 2 ;;
  esac
done

# ── Colors ────────────────────────────────────────────────────────
if [ -t 1 ]; then
  C_RESET=$'\033[0m'; C_BOLD=$'\033[1m'; C_DIM=$'\033[2m'
  C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'
  C_RED=$'\033[31m'; C_BLUE=$'\033[34m'
else
  C_RESET=""; C_BOLD=""; C_DIM=""; C_GREEN=""; C_YELLOW=""; C_RED=""; C_BLUE=""
fi

say()  { echo "${C_BOLD}${C_BLUE}▸${C_RESET} $*"; }
ok()   { echo "${C_GREEN}✓${C_RESET} $*"; }
warn() { echo "${C_YELLOW}!${C_RESET} $*"; }
fail() { echo "${C_RED}✗${C_RESET} $*" >&2; exit 1; }

# ── Pre-flight ────────────────────────────────────────────────────
[ -d .git ] || fail "Must run from the scheduler repo root (no .git/ here)."
[ -f docker-compose.yml ] || fail "docker-compose.yml not found."
command -v docker >/dev/null 2>&1 || fail "Docker not installed. See docs/HUAWEI-CLOUD-DEPLOY.md §4."

if [ ! -f .env.production ]; then
  if [ -f .env.production.example ]; then
    warn ".env.production missing — copying from .env.production.example."
    cp .env.production.example .env.production
  else
    fail "Neither .env.production nor .env.production.example found."
  fi
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  warn "Uncommitted local changes detected:"
  git status --short
  fail "Stash or commit local changes first:  git stash"
fi

# Host port for health-check (default 3000)
HOST_PORT=$(grep -E '^HOST_PORT=' .env.production 2>/dev/null | tail -1 | cut -d= -f2 | tr -d '"' || true)
HOST_PORT=${HOST_PORT:-3000}

# ── Record current state ──────────────────────────────────────────
PREV_SHA=$(git rev-parse HEAD)
PREV_SHORT=$(git rev-parse --short HEAD)
say "Current commit: ${C_BOLD}${PREV_SHORT}${C_RESET} — $(git log -1 --pretty=%s)"

# ── Detect running state ──────────────────────────────────────────
HAS_RUNNING=0
if docker compose ps --status running --quiet 2>/dev/null | grep -q .; then
  HAS_RUNNING=1
fi

HAS_DATA=0
if [ -f prod-data/scheduler.db ] && [ -s prod-data/scheduler.db ]; then
  HAS_DATA=1
fi

# ── Backup before touching anything ──────────────────────────────
if [ "$SKIP_BACKUP" = "1" ]; then
  warn "Backup skipped (--skip-backup)."
elif [ "$HAS_RUNNING" = "1" ] && [ "$HAS_DATA" = "1" ]; then
  say "Snapshotting DB + uploads before upgrade…"
  if bash scripts/backup.sh; then
    ok "Backup written."
  else
    warn "Backup FAILED — proceeding anyway (5s to Ctrl-C if you want to abort)."
    sleep 5
  fi
else
  warn "Skipping backup (no live container or no data — looks like first deploy)."
fi

# Save SHA for rollback hint
echo "$PREV_SHA" > .last-deployed-sha

# ── Pull ──────────────────────────────────────────────────────────
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
say "Fetching origin/$CURRENT_BRANCH…"
git fetch --quiet origin "$CURRENT_BRANCH"

REMOTE_SHA=$(git rev-parse "origin/$CURRENT_BRANCH")

if [ "$PREV_SHA" = "$REMOTE_SHA" ]; then
  warn "Already at latest commit. Will still rebuild + restart in case of env/image changes."
  warn "Ctrl-C now within 3s to abort."
  sleep 3
else
  # Show incoming commits
  say "New commits to deploy:"
  echo "${C_DIM}$(git log --oneline "$PREV_SHA..$REMOTE_SHA")${C_RESET}"
  echo

  # Highlight migration changes
  NEW_MIGRATIONS=$(git diff --name-only "$PREV_SHA" "$REMOTE_SHA" -- prisma/migrations/ | grep -E 'migration\.sql$' || true)
  if [ -n "$NEW_MIGRATIONS" ]; then
    warn "${C_BOLD}New Prisma migrations will run automatically on container start:${C_RESET}"
    echo "$NEW_MIGRATIONS" | sed "s/^/  ${C_DIM}/;s/$/${C_RESET}/"
    echo
    warn "If any contain DROP COLUMN / DROP TABLE / type changes → abort now and review manually."
    warn "Continuing in 5s…"
    sleep 5
  fi

  say "Pulling…"
  git pull --ff-only --quiet origin "$CURRENT_BRANCH"
  ok "Now at $(git rev-parse --short HEAD) — $(git log -1 --pretty=%s)"
fi

# ── Rebuild + restart ─────────────────────────────────────────────
say "Rebuilding image + restarting container (5–10 minutes on first build)…"
docker compose up -d --build

# ── Health check ──────────────────────────────────────────────────
say "Waiting for app on port $HOST_PORT…"
HEALTHY=0
CODE="000"
for _ in $(seq 1 30); do
  sleep 2
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$HOST_PORT/" 2>/dev/null || echo "000")
  case "$CODE" in
    200|301|302|307|308) HEALTHY=1; break ;;
  esac
done

if [ "$HEALTHY" != "1" ]; then
  echo
  echo "${C_RED}${C_BOLD}Health check FAILED.${C_RESET} Last HTTP code: $CODE"
  echo
  echo "  Inspect logs:  ${C_BOLD}docker compose logs --tail 80 app${C_RESET}"
  echo
  echo "  ${C_YELLOW}Rollback code:${C_RESET}"
  echo "    git reset --hard $PREV_SHA && docker compose up -d --build"
  echo
  echo "  ${C_YELLOW}Full restore (code + DB):${C_RESET}"
  echo "    docker compose down"
  echo "    tar -xzf backups/scheduler-<latest>.tar.gz -C prod-data/"
  echo "    mv prod-data/scheduler-snap.db prod-data/scheduler.db"
  echo "    git reset --hard $PREV_SHA"
  echo "    docker compose up -d --build"
  echo
  exit 1
fi

ok "App is responding (HTTP $CODE on /)."
echo
ok "${C_BOLD}Deploy complete.${C_RESET}"
echo
echo "  Logs:     ${C_DIM}docker compose logs -f app${C_RESET}"
echo "  Status:   ${C_DIM}docker compose ps${C_RESET}"
echo "  Backups:  ${C_DIM}ls -lh backups/${C_RESET}"
echo "  Rollback: ${C_DIM}git reset --hard $PREV_SHA && docker compose up -d --build${C_RESET}"
