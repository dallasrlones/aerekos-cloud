#!/usr/bin/env bash
# Runs full core-service E2E, then the orchestration feature suite (test-orchestration.sh).
# Same auth env vars as the individual scripts.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
echo "==> Part 1: e2e-full-stack (key_manager + storage_manager + db_manager)"
bash ./scripts/e2e-full-stack.sh
echo ""
echo "==> Part 2: test-orchestration (scaling, pin, load balancer, disable)"
# shellcheck disable=SC1091
export SKIP_DISABLE="${SKIP_DISABLE:-0}"
bash ./test-orchestration.sh
echo ""
echo "==> Part 3: production-plan waves (IaC hookup, auth, notify, vpc, edge, git, ops)"
exec node ./e2e/run-waves.js
