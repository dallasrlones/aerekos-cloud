#!/usr/bin/env bash
# Safe Mac → prod push. NO --delete. Secrets/device config never touched.
#
#   bash scripts/deploy/sync-diff.sh prod-mini   # review first
#   bash scripts/deploy/push-to-prod.sh          # apply + optional deploy
#
# Env:
#   AEREKOS_REMOTE=prod-mini
#   DEPLOY_AFTER=1          run deploy.sh on prod after rsync
#   PUBLISH_RELEASE=1       publish new release after deploy
#   APP_VERSION_OVERRIDE=   version stamp (default: UTC timestamp)
set -euo pipefail

REMOTE="${AEREKOS_REMOTE:-prod-mini}"
LOCAL="${AEREKOS_LOCAL_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
REMOTE_DIR="${AEREKOS_REMOTE_DIR:-/home/aerekos/work/aerekos/aerekos-cloud}"
NEWVER="${APP_VERSION_OVERRIDE:-$(date -u +%Y%m%d-%H%M%S)}"

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

log()  { printf '\033[1;36m▶ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$*"; }

log "Diff summary (no changes yet):"
bash "$(dirname "$0")/sync-diff.sh" "$REMOTE" | tail -20
echo ""
warn "This push does NOT use rsync --delete. Remote-only files are kept."
warn "Never rsync worker/.env — each device has its own CONDUCTOR_TOKEN."
if [ "${SYNC_CONFIRM:-}" != "yes" ]; then
  read -r -p "Continue push to $REMOTE? [y/N] " ans
  [[ "${ans:-}" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }
fi

log "Rsync Mac → $REMOTE (checksum, no --delete)"
# --chown ensures files land as aerekos (rsync as a different SSH user can silently skip overwrites).
RSYNC_CHOWN=(--chown=aerekos:aerekos)
ssh "$REMOTE" "id aerekos" >/dev/null 2>&1 || RSYNC_CHOWN=()
rsync -avz --checksum "${RSYNC_CHOWN[@]}" "${RSYNC_EXCLUDES[@]}" \
  "$LOCAL/" "$REMOTE:$REMOTE_DIR/"

if [ "${DEPLOY_AFTER:-0}" = "1" ]; then
  warn "DEPLOY_AFTER=1 skipped auto deploy.sh full (mixed stack). Rebuild roles per docs/runbooks/deploy.md"
fi

if [ "${PUBLISH_RELEASE:-0}" = "1" ]; then
  log "Publish release $NEWVER"
  ssh "$REMOTE" "cd '$REMOTE_DIR' && \
    bash scripts/release/publish.sh --version '$NEWVER' --notes 'push from MacBook'"
fi

log "Done. Dev/orin updaters will pull if you published a release."
