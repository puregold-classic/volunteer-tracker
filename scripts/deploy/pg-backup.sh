#!/usr/bin/env bash
#
# pg-backup.sh — sandbox PostgreSQL backup script for Mac mini deploy
#
# Dumps the volunteer_tracker database from the running postgres container,
# gzips the result into ./data/backups/, prunes old dumps using a GFS
# (Grandfather-Father-Son) rotation, then optionally chains a copy to
# iCloud Drive.
#
# Designed for the Mac mini sandbox where docker-compose.deploy.yml is up.
# It does NOT touch postgres directly — it shells into the container with
# `docker exec` so we don't need a libpq client on the host.
#
# Retention (GFS):
#   • last 7 days     — one dump per day  (daily slots)
#   • last 4 weeks    — one dump per ISO week (weekly slots)
#   • last 12 months  — one dump per calendar month (monthly slots)
#   • everything older — one dump per year (yearly slots, unbounded)
#
# Steady state ≈ 7 + 4 + 12 + N yearlies = 23 + N files (~150KB+ total).
# Filenames are timestamped so the prune logic parses YYYYMMDD out of the
# basename rather than relying on mtime.
#
# Usage:
#   ./scripts/deploy/pg-backup.sh
#   PG_CONTAINER_NAME=other-postgres ./scripts/deploy/pg-backup.sh
#   SKIP_ICLOUD=1 ./scripts/deploy/pg-backup.sh   # local-only run
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

# ─── GFS rotation ────────────────────────────────────────────────────────────
#
# Walk all dumps newest-to-oldest. For each one, decide which "slot" it
# satisfies (daily / weekly / monthly / yearly) and keep the first dump that
# fills each slot. Anything that doesn't fill a free slot gets deleted.
#
# Bucket keys:
#   day_bucket   = YYYYMMDD     (one slot per calendar day)
#   week_bucket  = GGGGWW       (ISO year + week, e.g. 202615)
#   month_bucket = YYYYMM       (one slot per calendar month)
#   year_bucket  = YYYY         (one slot per calendar year)
#
# Window thresholds (days_ago):
#   daily   < 7    → 7 daily slots
#   weekly  < 35   → 4 weekly slots beyond the daily window (1 ISO week buffer)
#   monthly < 400  → 12 monthly slots beyond the weekly window (1 month buffer)
#   yearly  ≥ 400  → unbounded yearly slots

today_epoch=$(date +%s)
declare -A kept_days kept_weeks kept_months kept_years
KEPT=0
PRUNED=0

# `ls -t` gives newest first. Filter to our naming pattern only.
while IFS= read -r dump; do
  [[ -z "$dump" ]] && continue
  basename=$(basename "$dump")
  ymd=$(echo "$basename" | sed -E "s/^${DB_NAME}-([0-9]{8})-.*/\1/")
  [[ "$ymd" == "$basename" ]] && continue   # filename did not match

  # Parse the YYYYMMDD into an epoch. BSD `date` (macOS) uses -j -f; GNU
  # date uses -d. Try both so the script also runs on Linux for restore tests.
  file_epoch=$(date -j -f "%Y%m%d" "$ymd" "+%s" 2>/dev/null \
              || date -d "${ymd:0:4}-${ymd:4:2}-${ymd:6:2}" "+%s" 2>/dev/null \
              || echo "")
  [[ -z "$file_epoch" ]] && continue

  days_ago=$(( (today_epoch - file_epoch) / 86400 ))
  day_bucket="$ymd"
  week_bucket=$(date -j -f "%Y%m%d" "$ymd" "+%G%V" 2>/dev/null \
                || date -d "${ymd:0:4}-${ymd:4:2}-${ymd:6:2}" "+%G%V" 2>/dev/null \
                || echo "")
  month_bucket="${ymd:0:6}"
  year_bucket="${ymd:0:4}"

  decision="prune"
  reason=""

  if (( days_ago < 7 )) && [[ -z "${kept_days[$day_bucket]:-}" ]]; then
    kept_days[$day_bucket]=1
    decision="keep"
    reason="daily"
  elif (( days_ago < 35 )) && [[ -n "$week_bucket" ]] && [[ -z "${kept_weeks[$week_bucket]:-}" ]]; then
    kept_weeks[$week_bucket]=1
    decision="keep"
    reason="weekly"
  elif (( days_ago < 400 )) && [[ -z "${kept_months[$month_bucket]:-}" ]]; then
    kept_months[$month_bucket]=1
    decision="keep"
    reason="monthly"
  elif [[ -z "${kept_years[$year_bucket]:-}" ]]; then
    kept_years[$year_bucket]=1
    decision="keep"
    reason="yearly"
  fi

  if [[ "$decision" == "keep" ]]; then
    KEPT=$((KEPT + 1))
    echo "  KEEP   $basename  (${reason}, ${days_ago}d ago)"
  else
    PRUNED=$((PRUNED + 1))
    echo "  PRUNE  $basename  (${days_ago}d ago)"
    rm -f "$dump"
  fi
done < <(ls -t "$BACKUP_DIR"/${DB_NAME}-*.sql.gz 2>/dev/null || true)

echo "$LOG_PREFIX GFS rotation: kept ${KEPT}, pruned ${PRUNED}"

# ─── iCloud Drive sync (best-effort, non-fatal) ──────────────────────────────

if [[ "${SKIP_ICLOUD:-0}" != "1" ]] && [[ -x "$SCRIPT_DIR/pg-backup-icloud.sh" ]]; then
  if "$SCRIPT_DIR/pg-backup-icloud.sh"; then
    :
  else
    echo "$LOG_PREFIX iCloud sync failed (non-fatal — local dump intact)" >&2
  fi
fi

# ─── Summary ─────────────────────────────────────────────────────────────────

REMAINING=$(find "$BACKUP_DIR" -type f -name "${DB_NAME}-*.sql.gz" | wc -l | tr -d ' ')
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | awk '{print $1}')
echo "$LOG_PREFIX done — ${REMAINING} dumps in $BACKUP_DIR, total size $TOTAL_SIZE"
