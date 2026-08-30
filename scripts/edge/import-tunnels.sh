#!/usr/bin/env bash
# Import existing Cloudflare tunnels into tunnel_manager for a project (ops-pre-5).
# Requires: CONDUCTOR_URL, AUTH_TOKEN (conductor JWT), PROJECT_ID
set -euo pipefail

BASE="${CONDUCTOR_URL:-http://localhost:3300}"
PROJECT_ID="${PROJECT_ID:?set PROJECT_ID}"
TOKEN="${AUTH_TOKEN:?set AUTH_TOKEN (conductor login JWT)}"

echo "Importing Cloudflare tunnels into project ${PROJECT_ID}..."
curl -fsS -X POST \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"project_id\":\"${PROJECT_ID}\"}" \
  "${BASE}/api/services/tunnel_manager/api/v1/tunnels/import-from-cloudflare"

echo ""
echo "Done. Open Edge Manager → Tunnels to configure ingress."
