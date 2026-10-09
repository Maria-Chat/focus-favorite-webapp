#!/usr/bin/env bash
# Disk watchdog: run alongside the dev servers.
#   bash scripts/disk-watchdog.sh &
# < WARN_GB  -> run cleanup.sh
# < STOP_GB  -> stop the Inngest dev server (pending items stay safe in Supabase)
set -u
DIR="$(cd "$(dirname "$0")" && pwd)"
WARN_GB="${WARN_GB:-3}"
STOP_GB="${STOP_GB:-1.5}"
INTERVAL="${INTERVAL:-60}"

free_gb() { df -k / | awk 'NR==2{printf "%.1f", $4/1048576}'; }
lt() { awk -v a="$1" -v b="$2" 'BEGIN{exit !(a<b)}'; }

echo "[watchdog] started (warn<${WARN_GB}GB, stop<${STOP_GB}GB, every ${INTERVAL}s)"
while true; do
  f=$(free_gb)
  if lt "$f" "$WARN_GB"; then
    echo "[watchdog] $(date +%H:%M) free=${f}GB -> cleanup"
    bash "$DIR/cleanup.sh" --quiet
    f=$(free_gb)
    if lt "$f" "$STOP_GB"; then
      echo "[watchdog] $(date +%H:%M) free=${f}GB still critical -> stopping Inngest worker"
      pkill -TERM -f "inngest dev" 2>/dev/null
      pkill -TERM -f "inngest-cli" 2>/dev/null
      osascript -e "display notification \"Disk เหลือ ${f}GB — หยุด Inngest แล้ว\" with title \"Focus Favorite\"" 2>/dev/null
    fi
  fi
  sleep "$INTERVAL"
done
