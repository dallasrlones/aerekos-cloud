#!/usr/bin/env bash
# W0: Recreate ONLY aerekos-ai_manager without tearing down compose networks/volumes.
# Usage: ./scripts/deploy/recover-ai-manager.sh [host]
# Prefer ADR 003 release when possible; this is emergency recovery after bad docker cp.
set -euo pipefail
HOST="${1:-prod-mini}"
CTR="${AI_MANAGER_CONTAINER:-aerekos-ai_manager}"
IMG="${AI_MANAGER_IMAGE:-aerekos-ai_manager:latest}"

echo "[recover-ai_manager] host=$HOST container=$CTR image=$IMG"
ssh -o BatchMode=yes "$HOST" bash -s <<EOF
set -euo pipefail
CTR='$CTR'
IMG='$IMG'
if ! docker image inspect "\$IMG" >/dev/null 2>&1; then
  echo "image \$IMG missing — abort (do not invent rebuild that wipes volumes)"
  exit 2
fi
# Capture prior run config for recreate
CID=\$(docker ps -aq --filter "name=^\${CTR}\$" | head -1)
if [[ -z "\$CID" ]]; then
  echo "container \$CTR not found"
  docker ps -a --filter name=ai_manager
  exit 3
fi
echo "stopping \$CTR..."
docker stop "\$CTR" || true
docker rm "\$CTR" || true
# Recreate via compose no-deps if full.yml present, else docker run from prior inspect is too fragile —
# prefer compose service name ai_manager when compose file exists.
if [[ -f /home/aerekos/aerekos/aerekos-cloud/docker-compose.full.yml ]]; then
  cd /home/aerekos/aerekos/aerekos-cloud
  docker compose -f docker-compose.full.yml up -d --no-deps --force-recreate ai_manager
elif [[ -f ~/aerekos/aerekos-cloud/docker-compose.full.yml ]]; then
  cd ~/aerekos/aerekos-cloud
  docker compose -f docker-compose.full.yml up -d --no-deps --force-recreate ai_manager
else
  echo "compose file not found; start \$CTR manually from \$IMG with existing volume ai_manager-data"
  exit 4
fi
sleep 3
docker ps --filter "name=\$CTR" --format '{{.Names}} {{.Status}}'
docker exec "\$CTR" node -e "require('./api/services/IcarusFacade'); console.log('IcarusFacade ok')" 2>/dev/null \
  || docker exec "\$CTR" node -e "require('/app/ai_manager/api/services/IcarusFacade'); console.log('IcarusFacade ok')" \
  || echo "WARN: Facade smoke failed — sync full worker/ai_manager including api/services/graph/**"
curl -sf "http://127.0.0.1:3126/health" && echo || echo "health check failed"
EOF
echo "[recover-ai_manager] done"
