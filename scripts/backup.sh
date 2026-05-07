#!/bin/bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
DATA_DIR_HOST="${DATA_DIR_HOST:-./prod-data}"
COMPOSE_SERVICE="${COMPOSE_SERVICE:-app}"

mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# 1. SQLite atomic snapshot inside the container
echo "▸ Creating SQLite snapshot via container..."
docker compose exec -T "$COMPOSE_SERVICE" \
  sqlite3 /data/scheduler.db ".backup /data/scheduler-snap.db"

# 2. Tar snapshot + uploads from the host's mounted volume
ARCHIVE="$BACKUP_DIR/scheduler-${TIMESTAMP}.tar.gz"
echo "▸ Creating archive: $ARCHIVE"

TAR_TARGETS=""
[ -f "$DATA_DIR_HOST/scheduler-snap.db" ] && TAR_TARGETS="$TAR_TARGETS scheduler-snap.db"
[ -d "$DATA_DIR_HOST/uploads" ] && TAR_TARGETS="$TAR_TARGETS uploads"

if [ -z "$TAR_TARGETS" ]; then
  echo "✗ Nothing to back up in $DATA_DIR_HOST"
  exit 1
fi

tar -czf "$ARCHIVE" -C "$DATA_DIR_HOST" $TAR_TARGETS

# 3. Cleanup temp snapshot
rm -f "$DATA_DIR_HOST/scheduler-snap.db"

# 4. Retention
echo "▸ Cleaning backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name 'scheduler-*.tar.gz' -mtime +"$RETENTION_DAYS" -delete

echo "✓ $ARCHIVE"
ls -lh "$ARCHIVE"
