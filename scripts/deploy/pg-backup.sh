#!/usr/bin/env bash
#
# pg-backup.sh — sandbox PostgreSQL backup script for Mac mini deploy
#
# Dumps the volunteer_tracker database from the running postgres container,
# gzips the result into ./data/backups/, and prunes anything older than the
# retention window.
#
# Designed for the Mac mini sandbox where docker-compose.deploy.yml is up.
# It does NOT touch postgres directly — it shells into the container with
# `docker exec` so we don't need a libpq client on the host.
#
# Usage:
#   ./scripts/deploy/pg-backup.sh           # default retention
#   RETAIN_DAYS=14 ./scripts/deploy/pg-backup.sh
#
# Exit codes:
#   0  ok
#   1  generic failure
#   2  prerequisites missing
#   3  pg_dump failed
#
# Restore (from a dump file):
#   gunzip -c data/backups/volunteer_tracker-YYYYMMDD-HHMMSS.sql.gz | \
#     docker exec -i volunteer-tracker-deploy-postgres-1 \
#     psql -U volunteer_user -d volunteer_tracker
#
# Note: a destructive restore should drop+recreate the DB first. See
# docs/deploy/backup-strategy.md for the full restore procedure.

set -euo pipefail

# ─── Config ──────────────────────────────────────────────────────────────────

CONTAINER_NAME="${PG_CONTAINER_NAME:-volunteer-tracker-deploy-postgres-1}"
DB_NAME="${PG_DB_NAME:-volunteer_tracker}"
DB_USER="${PG_DB_USER:-volunteer_user}"
RETAIN_DAYS="${RETAIN_DAYS:-30}"

# Resolve project root from this script's location so launchd / cron can call
# it from any cwd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_DIR="$PROJECT_ROOT/data/backups"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
DUMP_FILE="$BACKUP_DIR/${DB_NAME}-${TIMESTAMP}.sql.gz"
LOG_PREFIX="[pg-backup $TIMESTAMP]"

# Make sure docker is on PATH (launchd starts with a minimal PATH)
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

# ─── Prerequisites ───────────────────────────────────────────────────────────

if ! command -v docker >/dev/null 2>&1; then
  echo "$LOG_PREFIX docker not found on PATH" >&2
  exit 2
fi

if ! docker inspect -f '{{.State.Running}}' "$CONTAINER_NAME" >/dev/null 2>&1; then
  echo "$LOG_PREFIX container '$CONTAINER_NAME' is not running" >&2
  exit 2
fi

mkdir -p "$BACKUP_DIR"

# ─── Dump ────────────────────────────────────────────────────────────────────

echo "$LOG_PREFIX dumping $DB_NAME → $DUMP_FILE"

# pg_dump runs inside the container, gzips on the fly, lands on host volume.
# --clean --if-exists makes the dump self-restoring (recreates objects).
if ! docker exec "$CONTAINER_NAME" \
       pg_dump -U "$DB_USER" --clean --if-exists --no-owner --no-privileges "$DB_NAME" \
       | gzip > "$DUMP_FILE"; then
  echo "$LOG_PREFIX pg_dump failed" >&2
  rm -f "$DUMP_FILE"
  exit 3
fi

# Sanity-check the dump is non-empty (a 0-byte gzip is suspicious)
DUMP_SIZE=$(stat -f%z "$DUMP_FILE" 2>/dev/null || stat -c%s "$DUMP_FILE" 2>/dev/null || echo 0)
if [[ "$DUMP_SIZE" -lt 200 ]]; then
  echo "$LOG_PREFIX dump suspiciously small ($DUMP_SIZE bytes); removing" >&2
  rm -f "$DUMP_FILE"
  exit 3
fi

echo "$LOG_PREFIX wrote $DUMP_FILE (${DUMP_SIZE} bytes)"

# ─── Rotate ──────────────────────────────────────────────────────────────────

# Delete dumps older than RETAIN_DAYS. -mtime +N matches files modified more
# than N days ago. Use -delete (BSD/GNU find both support it).
PRUNED=$(find "$BACKUP_DIR" -type f -name "${DB_NAME}-*.sql.gz" -mtime "+${RETAIN_DAYS}" -print -delete | wc -l | tr -d ' ')
echo "$LOG_PREFIX pruned ${PRUNED} dump(s) older than ${RETAIN_DAYS} days"

# ─── Summary ─────────────────────────────────────────────────────────────────

REMAINING=$(find "$BACKUP_DIR" -type f -name "${DB_NAME}-*.sql.gz" | wc -l | tr -d ' ')
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | awk '{print $1}')
echo "$LOG_PREFIX done — ${REMAINING} dumps in $BACKUP_DIR, total size $TOTAL_SIZE"
