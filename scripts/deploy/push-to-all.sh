#!/usr/bin/env bash
# Push the Mac source-of-truth tree to every fleet device. NO --delete.
# Does not overwrite device .env / worker/.env / data / node_modules.
#
#   SYNC_CONFIRM=yes bash scripts/deploy/push-to-all.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
HOSTS=(${AEREKOS_PUSH_HOSTS:-prod-mini dev-mini oculus})

log() { printf '\033[1;36m▶ %s\033[0m\n' "$*"; }

if [ "${SYNC_CONFIRM:-}" != "yes" ]; then
  read -r -p "Push Mac → ${HOSTS[*]}? [y/N] " ans
  [[ "${ans:-}" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }
fi

export SYNC_CONFIRM=yes
for host in "${HOSTS[@]}"; do
  log "=== $host ==="
  bash "$ROOT/push-to-host.sh" "$host"
done

log "Code is on the boxes. Rebuild roles per docs/runbooks/deploy.md"
