#!/usr/bin/env bash
# Deploy a cloudflared connector as a compute task (system project only).
# Usage: EDGE_TUNNEL_TOKEN=... PROJECT_ID=9d8bde11-6933-4732-b746-602dcf72eaa5 ./scripts/deploy/run-cloudflared.sh
set -euo pipefail
PROJECT_ID="${PROJECT_ID:-9d8bde11-6933-4732-b746-602dcf72eaa5}"
if [[ -z "${EDGE_TUNNEL_TOKEN:-}" ]]; then
  echo "Set EDGE_TUNNEL_TOKEN from tunnel_manager create (shown once)." >&2
  exit 1
fi
echo "Create a compute task named cloudflared with image cloudflare/cloudflared:latest"
echo "command: tunnel --no-autoupdate run --token \$EDGE_TUNNEL_TOKEN"
echo "project: $PROJECT_ID"
echo "Do not run this against ea370977-3aff-4c76-95a6-a0c50fd2bce7."
