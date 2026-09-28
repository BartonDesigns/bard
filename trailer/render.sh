#!/bin/bash
# Renders the trailer shot by shot (one browser, one lock per shot, so another job sharing
# the machine gets its turn between shots and a restart loses at most one shot), then cuts it.
#
#   trailer/render.sh [capture flags...]     e.g. trailer/render.sh --gpu --w 3840 --h 2160
#
# FRAMES (default /tmp/claude-0/trailer/frames), LOCK (/tmp/claude-0/browser.lock) and
# LOG (/tmp/claude-0/trailer/progress.log) may be set in the environment.
set -u
cd "$(dirname "$0")/.."
FRAMES=${FRAMES:-/tmp/claude-0/trailer/frames}
LOCK=${LOCK:-/tmp/claude-0/browser.lock}
LOG=${LOG:-/tmp/claude-0/trailer/progress.log}
mkdir -p "$(dirname "$LOG")" "$FRAMES"
ids=$(node trailer/capture.mjs --list | awk '$1 != "total" { print $1 }')
for id in $ids; do
	echo "$(date '+%F %T') shot $id: start" >> "$LOG"
	for try in 1 2 3; do
		if flock "$LOCK" timeout 7200 node trailer/capture.mjs --frames "$FRAMES" --only "$id" "$@" >> "$LOG" 2>&1; then break; fi
		echo "$(date '+%F %T') shot $id: attempt $try failed" >> "$LOG"
	done
	echo "$(date '+%F %T') shot $id: $(ls "$FRAMES/$id" 2>/dev/null | wc -l) frames on disk" >> "$LOG"
done
echo "$(date '+%F %T') capture finished" >> "$LOG"
