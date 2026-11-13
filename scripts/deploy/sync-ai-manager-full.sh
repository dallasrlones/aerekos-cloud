#!/usr/bin/env bash
# Safe full-tree sync of worker/ai_manager into a running container (never single-file Facade).
# Usage: ./scripts/deploy/sync-ai-manager-full.sh <host> [container]
set -euo pipefail
HOST="${1:?host required e.g. prod-mini}"
CTR="${2:-aerekos-ai_manager}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="$ROOT/worker/ai_manager"
TMP="/tmp/ai_manager_sync_$$"
test -d "$SRC/api/services/graph"
test -f "$SRC/api/services/IcarusFacade.js"
test -f "$SRC/api/routes/index.js"

echo "[sync] packing $SRC → $HOST:$CTR"
rm -rf "$TMP" && mkdir -p "$TMP"
rsync -a --exclude node_modules --exclude data --exclude .git "$SRC/" "$TMP/ai_manager/"
tar -C "$TMP" -czf "$TMP/ai_manager.tgz" ai_manager
scp -o BatchMode=yes "$TMP/ai_manager.tgz" "$HOST:/tmp/ai_manager.tgz"
ssh -o BatchMode=yes "$HOST" bash -s <<EOF
set -euo pipefail
CTR='$CTR'
docker cp /tmp/ai_manager.tgz "\$CTR:/tmp/ai_manager.tgz"
docker exec "\$CTR" bash -lc 'cd /app && tar xzf /tmp/ai_manager.tgz && node -e "require(\"./ai_manager/api/services/IcarusFacade\"); console.log(\"Facade+graph ok\")"' \
  || docker exec "\$CTR" bash -lc 'cd /app/ai_manager && tar xzf /tmp/ai_manager.tgz --strip-components=1 && node -e "require(\"./api/services/IcarusFacade\"); console.log(\"Facade+graph ok\")"'
docker restart "\$CTR"
sleep 2
docker ps --filter name="\$CTR" --format '{{.Names}} {{.Status}}'
EOF
rm -rf "$TMP"
echo "[sync] done — prefer ADR 003 release next time"
