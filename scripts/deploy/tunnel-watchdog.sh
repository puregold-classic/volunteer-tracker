#!/usr/bin/env bash
#
# tunnel-watchdog.sh — keep cloudflared tunnel reachable from public URL
#
# Probes the public URL. Tracks consecutive failures in a state file. After
# N consecutive failures, hard-restarts cloudflared via launchctl kickstart.
#
# Designed to run as a system LaunchDaemon (root) every 2 minutes — see
# com.volunteer-tracker.tunnel-watchdog.plist.template. Can also be invoked
# manually for testing (any uid; kickstart will then need sudo).
#
# Why this exists:
#   cloudflared can keep its process alive while ALL tunnel→edge connections
#   are dropped. Observed 2026-04-09: 11h with 0 active connections, process
#   up the entire time. launchd's KeepAlive=SuccessfulExit only restarts on
#   process exit, so it cannot catch this failure mode. This watchdog detects
#   it via end-to-end public probe and forces a hard restart.
#
# Configurable via env vars:
#   PROBE_URL          - URL to probe (default: dev sandbox /api/health)
#   FAILURE_THRESHOLD  - consecutive failures before kickstart (default: 2)
#   PROBE_TIMEOUT      - curl timeout in seconds (default: 10)
#   STATE_FILE         - failure counter location (default: /var/run/...)
#   LOG_FILE           - log path (default: /Library/Logs/...)
#   NTFY_SERVER        - ntfy server (default: https://ntfy.sh)
#   NTFY_TOPIC         - ntfy topic name; empty disables notifications
#
# Exit codes:
#   0  probe ok, or kickstart issued successfully
#   1  kickstart attempted but failed
#
# Manual test (as root, e.g. via sudo):
#   sudo NTFY_TOPIC=your-topic ./scripts/deploy/tunnel-watchdog.sh
#   sudo tail -f /Library/Logs/volunteer-tracker-tunnel-watchdog.log
#

set -eu

PROBE_URL="${PROBE_URL:-https://dev.puregoldclassictranslation.com/api/health}"
FAILURE_THRESHOLD="${FAILURE_THRESHOLD:-2}"
PROBE_TIMEOUT="${PROBE_TIMEOUT:-10}"
STATE_FILE="${STATE_FILE:-/var/run/volunteer-tracker-tunnel-watchdog.state}"
LOG_FILE="${LOG_FILE:-/Library/Logs/volunteer-tracker-tunnel-watchdog.log}"
NTFY_SERVER="${NTFY_SERVER:-https://ntfy.sh}"
NTFY_TOPIC="${NTFY_TOPIC:-}"
TUNNEL_LABEL="system/com.cloudflare.cloudflared"

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$*" >> "$LOG_FILE" 2>/dev/null || true
}

# notify <title> <priority> <tags> <message>
# Best-effort POST to ntfy. No-op if NTFY_TOPIC is empty. Never fatal —
# notification path is auxiliary to log file, must not crash the watchdog.
notify() {
  [ -z "$NTFY_TOPIC" ] && return 0
  local title="$1"
  local priority="$2"
  local tags="$3"
  local message="$4"
  curl -sS -X POST \
    -H "Title: $title" \
    -H "Priority: $priority" \
    -H "Tags: $tags" \
    --max-time 10 \
    -d "$message" \
    "$NTFY_SERVER/$NTFY_TOPIC" >/dev/null 2>&1 \
    || log "notify failed (non-fatal): $title"
}

read_count() {
  if [ -f "$STATE_FILE" ]; then
    cat "$STATE_FILE" 2>/dev/null || echo 0
  else
    echo 0
  fi
}

write_count() {
  printf '%s' "$1" > "$STATE_FILE" 2>/dev/null || true
}

# Probe — capture HTTP code only, hard timeout, treat any failure as 000
http_code=$(curl -sS -o /dev/null -w '%{http_code}' \
  --max-time "$PROBE_TIMEOUT" "$PROBE_URL" 2>/dev/null || echo 000)

if [ "$http_code" = "200" ]; then
  prev=$(read_count)
  if [ "$prev" -gt 0 ]; then
    log "OK (recovered after $prev failure(s)): $PROBE_URL -> 200"
    write_count 0
    notify "Tunnel recovered" "default" "white_check_mark" \
      "Public URL is back to 200 after $prev failed probe(s). $PROBE_URL"
  fi
  exit 0
fi

# Failure path
count=$(($(read_count) + 1))
write_count "$count"
log "FAIL ($count/$FAILURE_THRESHOLD): $PROBE_URL -> $http_code"

if [ "$count" -ge "$FAILURE_THRESHOLD" ]; then
  log "ACTION: kickstart $TUNNEL_LABEL after $count consecutive failures"
  if /bin/launchctl kickstart -k "$TUNNEL_LABEL" 2>>"$LOG_FILE"; then
    log "kickstart issued OK"
    notify "Tunnel down — kickstart fired" "high" "rotating_light" \
      "Watchdog detected $count consecutive failed probes (HTTP $http_code) and forced restart of cloudflared. Next probe in 2 min will confirm recovery."
    # Reset counter — next probe (in 2 min) will report whether recovery worked
    write_count 0
    exit 0
  else
    log "kickstart FAILED (uid=$(id -u); needs root)"
    notify "Watchdog can't recover tunnel" "max" "x,sos" \
      "kickstart of $TUNNEL_LABEL FAILED (uid=$(id -u)). Manual intervention required: ssh to Mac mini and check launchd / cloudflared state."
    exit 1
  fi
fi
