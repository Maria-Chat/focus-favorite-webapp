#!/usr/bin/env bash
# Frees disk space used by this project's dev workflow. Safe to run anytime.
#   bash scripts/cleanup.sh          -> normal cleanup
#   bash scripts/cleanup.sh --quiet  -> no output except the summary line
set -u
QUIET="${1:-}"
T="${TMPDIR:-/tmp}"
log() { [ "$QUIET" = "--quiet" ] || echo "$@"; }

before=$(df -k / | awk 'NR==2{print $4}')

# 1) Leaked PyInstaller extraction dirs from yt-dlp_macos (~72MB each).
#    Only remove ones older than 3 min so we never touch a running process.
find "$T" -maxdepth 1 -name '_MEI*' -type d -mmin +3 -exec rm -rf {} + 2>/dev/null
# 2) Our per-job temp dirs / old-style audio files older than 10 min
find "$T" -maxdepth 1 \( -name 'fav_*' -o -name 'audio_*' \) -mmin +10 -exec rm -rf {} + 2>/dev/null
# 3) npm debug logs
rm -rf "$HOME/.npm/_logs/"* 2>/dev/null
# 4) Rotated dev-server logs older than 1 day
find "$(dirname "$0")/../.logs" -type f -mtime +1 -delete 2>/dev/null
# 5) yt-dlp cache
rm -rf "$HOME/.cache/yt-dlp" 2>/dev/null

after=$(df -k / | awk 'NR==2{print $4}')
freed=$(( (after - before) / 1024 ))
echo "[cleanup] freed ${freed}MB, free now: $(df -h / | awk 'NR==2{print $4}')"
