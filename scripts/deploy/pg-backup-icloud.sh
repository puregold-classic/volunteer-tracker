#!/usr/bin/env bash
#
# pg-backup-icloud.sh — copy the latest local dump to iCloud Drive
#
# Two-tier backup strategy:
#   • Mac mini local (data/backups/) holds GFS rotation — 7 daily +
#     4 weekly + 12 monthly + N yearly. This is the long memory.
#   • iCloud Drive (~/Library/Mobile Documents/com~apple~CloudDocs/
#     volunteer-tracker-backups/) holds rolling 30 daily snapshots —
#     the off-machine cushion. iCloud handles the multi-device sync
#     and at-rest encryption for free.
#
# This script is normally called by pg-backup.sh after the dump + GFS
# prune finish, but it's safe to run standalone too.
#
# Why no GPG: iCloud Drive is end-to-end encrypted by Apple (Advanced
# Data Protection or even baseline encryption for the iCloud Drive
# bucket). Adding our own passphrase layer adds management burden
# without meaningful additional protection for this threat model.
#
# Usage:
#   ./scripts/deploy/pg-backup-icloud.sh
#   ICLOUD_RETAIN_DAYS=14 ./scripts/deploy/pg-backup-icloud.sh
#
# Exit codes:
#   0  ok
#   1  generic failure
#   2  iCloud Drive directory missing (Apple ID not signed in?)
#   3  no local dump to copy

set -euo pipefail

ICLOUD_ROOT="$HOME/Library/Mobile Documents/com~apple~CloudDocs"
ICLOUD_DIR="$ICLOUD_ROOT/volunteer-tracker-backups"
ICLOUD_RETAIN_DAYS="${ICLOUD_RETAIN_DAYS:-30}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_DIR="$PROJECT_ROOT/data/backups"
DB_NAME="${PG_DB_NAME:-volunteer_tracker}"
LOG_PREFIX="[icloud-sync $(date +%Y%m%d-%H%M%S)]"

if [[ ! -d "$ICLOUD_ROOT" ]]; then
  echo "$LOG_PREFIX iCloud Drive root not found ($ICLOUD_ROOT) — Apple ID signed in?" >&2
  exit 2
fi

mkdir -p "$ICLOUD_DIR"

LATEST=$(ls -t "$BACKUP_DIR"/${DB_NAME}-*.sql.gz 2>/dev/null | head -1 || true)
if [[ -z "$LATEST" ]]; then
  echo "$LOG_PREFIX no local backup found in $BACKUP_DIR" >&2
  exit 3
fi

DEST="$ICLOUD_DIR/$(basename "$LATEST")"
if [[ -e "$DEST" ]]; then
  echo "$LOG_PREFIX $(basename "$LATEST") already in iCloud, skipping copy"
else
  cp "$LATEST" "$DEST"
  echo "$LOG_PREFIX copied $(basename "$LATEST") to iCloud Drive"
fi

# Rolling 30-day prune. iCloud-side keeps daily-only, no GFS — long
# memory lives on the Mac mini.
PRUNED=$(find "$ICLOUD_DIR" -type f -name "${DB_NAME}-*.sql.gz" -mtime "+${ICLOUD_RETAIN_DAYS}" -print -delete | wc -l | tr -d ' ')
echo "$LOG_PREFIX pruned ${PRUNED} file(s) older than ${ICLOUD_RETAIN_DAYS} days from iCloud"

REMAINING=$(find "$ICLOUD_DIR" -type f -name "${DB_NAME}-*.sql.gz" | wc -l | tr -d ' ')
echo "$LOG_PREFIX iCloud now holds ${REMAINING} dump(s)"
