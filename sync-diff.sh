#!/usr/bin/env bash
# Compare local Mac checkout vs a remote deploy dir — no changes made.
#
#   bash scripts/deploy/sync-diff.sh prod.aerekos.com
#   bash scripts/deploy/sync-diff.sh dev.aerekos.com
#   bash scripts/deploy/sync-diff.sh orin.aerekos.com
#
# Shows what would be updated (Mac → remote) and what exists only on remote
# (would be deleted by rsync --delete — never do that blindly).
set -euo pipefail

REMOTE="${1:?usage: sync-diff.sh <host>}"
LOCAL="${AEREKOS_LOCAL_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
REMOTE_DIR="${AEREKOS_REMOTE_DIR:-/home/aerekos/work/aerekos/aerekos-cloud}"

RSYNC_EXCLUDES=(
  --exclude '.git'
  --exclude 'node_modules' --exclude '*/node_modules'
  --exclude '.env' --exclude '.env.*' --exclude 'worker/.env' --exclude 'worker/.env.local'
  --exclude 'data' --exclude '*/data'
  --exclude '.expo' --exclude '*/.expo'
  --exclude 'coverage' --exclude '*/coverage'
  --exclude 'VERSION'
  --exclude '.worker-host.env'
)

log() { printf '\033[1;36m▶ %s\033[0m\n' "$*"; }

log "Local:  $LOCAL"
log "Remote: $REMOTE:$REMOTE_DIR"
echo ""

log "Files Mac would UPDATE on remote (checksum diff, no --delete):"
rsync -avzn --checksum "${RSYNC_EXCLUDES[@]}" \
  "$LOCAL/" "$REMOTE:$REMOTE_DIR/" 2>/dev/null \
  | awk '/^>f/ {print "  update:", $2}' | head -50
UPDATE_COUNT=$(rsync -avzn --checksum "${RSYNC_EXCLUDES[@]}" \
  "$LOCAL/" "$REMOTE:$REMOTE_DIR/" 2>/dev/null \
  | awk '/^>f/' | wc -l | tr -d ' ')
echo "  ... ($UPDATE_COUNT files total)"
echo ""

log "Building file lists for only-on-remote check..."
LOCAL_LIST=$(mktemp)
REMOTE_LIST=$(mktemp)
trap 'rm -f "$LOCAL_LIST" "$REMOTE_LIST"' EXIT

find "$LOCAL" -type f \
  ! -path '*/.git/*' ! -path '*/node_modules/*' ! -path '*/data/*' \
  ! -path '*/.expo/*' ! -path '*/coverage/*' \
  | sed "s|^$LOCAL/||" | sort > "$LOCAL_LIST"

ssh "$REMOTE" "find '$REMOTE_DIR' -type f \
  ! -path '*/.git/*' ! -path '*/node_modules/*' ! -path '*/data/*' \
  ! -path '*/.expo/*' ! -path '*/coverage/*' \
  -printf '%P\n' 2>/dev/null | sort" > "$REMOTE_LIST" || true

ONLY_REMOTE=$(comm -23 "$REMOTE_LIST" "$LOCAL_LIST" \
  | grep -vE '^(coverage/|.*lcov-report/)' | head -30)
ONLY_LOCAL=$(comm -13 "$REMOTE_LIST" "$LOCAL_LIST" | head -20)

log "Only on REMOTE (rsync --delete would REMOVE these — review before deleting):"
if [ -n "$ONLY_REMOTE" ]; then
  echo "$ONLY_REMOTE" | sed 's/^/  /'
  echo "  ... ($(comm -23 "$REMOTE_LIST" "$LOCAL_LIST" | wc -l | tr -d ' ') total)"
else
  echo "  (none)"
fi
echo ""

log "Only on MAC (would be ADDED on push):"
if [ -n "$ONLY_LOCAL" ]; then
  echo "$ONLY_LOCAL" | sed 's/^/  /'
else
  echo "  (none)"
fi
echo ""

log "Content diffs for critical paths:"
for f in \
  conductor/app/utils/api.js \
  conductor/api/services/ServiceManager.js \
  conductor/api/services/SetupService.js \
  worker/api/services/ConductorSocketService.js \
  updater/update-loop.sh \
  scripts/deploy/deploy.sh; do
  if ssh "$REMOTE" "test -f '$REMOTE_DIR/$f'" 2>/dev/null; then
    if diff -q "$LOCAL/$f" <(ssh "$REMOTE" "cat '$REMOTE_DIR/$f'") >/dev/null 2>&1; then
      echo "  ✓ $f — identical"
    else
      echo "  ≠ $f — DIFFERS (run: diff -u <(ssh $REMOTE cat .../$f) $LOCAL/$f)"
    fi
  else
    echo "  + $f — missing on remote"
  fi
done
