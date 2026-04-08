#!/usr/bin/env bash
#
# pg-restore.sh — restore a sandbox PostgreSQL dump
#
# DESTRUCTIVE. Drops the existing database and rebuilds from the chosen dump.
# Always backs up the current state to a "pre-restore" file first as a safety net.
#
# Usage:
#   ./scripts/deploy/pg-restore.sh data/backups/volunteer_tracker-20260408-120000.sql.gz
#   ./scripts/deploy/pg-restore.sh latest          # picks the most recent dump

set -euo pipefail

CONTAINER_NAME="${PG_CONTAINER_NAME:-volunteer-tracker-deploy-postgres-1}"
DB_NAME="${PG_DB_NAME:-volunteer_tracker}"
DB_USER="${PG_DB_USER:-volunteer_user}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_DIR="$PROJECT_ROOT/data/backups"

export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <dump-file | latest>" >&2
  exit 1
fi

if [[ "$1" == "latest" ]]; then
  DUMP_FILE=$(ls -t "$BACKUP_DIR"/${DB_NAME}-*.sql.gz 2>/dev/null | head -1)
  if [[ -z "$DUMP_FILE" ]]; then
    echo "no dumps in $BACKUP_DIR" >&2
    exit 1
  fi
else
  DUMP_FILE="$1"
fi

if [[ ! -f "$DUMP_FILE" ]]; then
  echo "dump file not found: $DUMP_FILE" >&2
  exit 1
fi

echo "WARNING: this will DROP and recreate database '$DB_NAME' in container '$CONTAINER_NAME'."
echo "Restoring from: $DUMP_FILE"
echo
read -p "Type 'RESTORE' to confirm: " confirm
if [[ "$confirm" != "RESTORE" ]]; then
  echo "aborted" >&2
  exit 1
fi

# Safety net: dump current state first
SAFETY_FILE="$BACKUP_DIR/${DB_NAME}-pre-restore-$(date +%Y%m%d-%H%M%S).sql.gz"
echo "→ saving current state to $SAFETY_FILE (safety net)"
docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" --clean --if-exists --no-owner --no-privileges "$DB_NAME" \
  | gzip > "$SAFETY_FILE"

echo "→ dropping and recreating $DB_NAME"
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;"
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"

echo "→ piping $DUMP_FILE into the new database"
gunzip -c "$DUMP_FILE" | docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME"

echo
echo "✓ restore complete. Safety net: $SAFETY_FILE"
echo "  If something is wrong, run: $0 $SAFETY_FILE"
