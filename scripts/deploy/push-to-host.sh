#!/usr/bin/env bash
# Safe Mac → any host push (no --delete). Same excludes as push-to-prod.sh.
#   bash scripts/deploy/push-to-host.sh dev.aerekos.com
#   bash scripts/deploy/push-to-host.sh orin.aerekos.com
set -euo pipefail

REMOTE="${1:?usage: push-to-host.sh <host>}"
LOCAL="${AEREKOS_LOCAL_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
REMOTE_DIR="${AEREKOS_REMOTE_DIR:-/home/aerekos/work/aerekos/aerekos-cloud}"

RSYNC_EXCLUDES=(
  --exclude '.git'
  --exclude 'node_modules' --exclude '*/node_modules'
  --exclude '.env' --exclude '.env.*'
  --exclude 'worker/.env' --exclude 'worker/.env.local'
  --exclude 'data' --exclude '*/data'
  --exclude '.expo' --exclude '*/.expo'
  --exclude 'coverage' --exclude '*/coverage'
  --exclude '.cursor/'
  --exclude '*.db' --exclude '*.db-shm' --exclude '*.db-wal'
  --exclude 'VERSION'
  --exclude '.worker-host.env'
)

log() { printf '\033[1;36m▶ %s\033[0m\n' "$*"; }

log "Diff: bash scripts/deploy/sync-diff.sh $REMOTE"
bash "$(dirname "$0")/sync-diff.sh" "$REMOTE" | grep -E '^(▶|  ✓|  ≠|  \+|  update:|  \.\.\.)' || true
echo ""

if [ "${SYNC_CONFIRM:-}" != "yes" ]; then
  read -r -p "Push Mac → $REMOTE? [y/N] " ans
  [[ "${ans:-}" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }
fi

log "Rsync (checksum, no --delete) → $REMOTE:$REMOTE_DIR"
rsync -avz --checksum "${RSYNC_EXCLUDES[@]}" \
  "$LOCAL/" "$REMOTE:$REMOTE_DIR/"

log "Done. worker/.env on $REMOTE was NOT touched."
