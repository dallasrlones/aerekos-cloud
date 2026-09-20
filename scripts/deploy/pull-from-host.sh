#!/usr/bin/env bash
# Pull device-only files onto the Mac source of truth. Does NOT overwrite
# files that already exist on Mac (Mac wins). Secrets/env/data excluded.
#
#   bash scripts/deploy/pull-from-host.sh prod-mini
#   bash scripts/deploy/pull-from-host.sh dev-mini
#   bash scripts/deploy/pull-from-host.sh oculus
set -euo pipefail

REMOTE="${1:?usage: pull-from-host.sh <ssh-host>}"
LOCAL="${AEREKOS_LOCAL_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
REMOTE_DIR="${AEREKOS_REMOTE_DIR:-/home/aerekos/work/aerekos/aerekos-cloud}"

RSYNC_EXCLUDES=(
  --exclude '.git/'
  --exclude 'node_modules/' --exclude '*/node_modules/'
  --exclude '.env' --exclude '.env.*'
  --exclude 'worker/.env' --exclude 'worker/.env.local'
  --exclude 'conductor/.env' --exclude 'conductor/app/.env' --exclude 'app/.env'
  --exclude 'data/' --exclude '*/data/'
  --exclude '.expo/' --exclude '*/.expo/'
  --exclude 'coverage/' --exclude '*/coverage/'
  --exclude '.worker-host.env' --exclude 'worker/.worker-host.env'
  --exclude 'VERSION'
  --exclude '.cursor/'
  --exclude '*.db' --exclude '*.db-shm' --exclude '*.db-wal'
  --exclude '.DS_Store'
)

log() { printf '\033[1;36m▶ %s\033[0m\n' "$*"; }

log "Pull $REMOTE:$REMOTE_DIR → $LOCAL (--ignore-existing, no --delete)"
rsync -avz --checksum --ignore-existing "${RSYNC_EXCLUDES[@]}" \
  "$REMOTE:$REMOTE_DIR/" "$LOCAL/"

log "Done. Existing Mac files were kept. Review git status, then push-to-all."
