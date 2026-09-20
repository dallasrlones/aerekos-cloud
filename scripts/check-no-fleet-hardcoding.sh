#!/usr/bin/env bash
# Fail if private LAN IPs or fleet-specific integration names appear in OSS paths.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PATTERNS=(
  '192\.168\.'
  '10\.0\.'
  'orin-vllm'
  'orin-ollama'
  '192\.168\.0\.221'
  'prod-mini'
  'dev-mini'
)

FAIL=0
for pat in "${PATTERNS[@]}"; do
  if rg -n "$pat" worker/ai_manager/api conductor/app/screens/AIManager --glob '!**/guides.js' --glob '!**/*.md' 2>/dev/null; then
    echo "hardcoding check failed: pattern $pat"
    FAIL=1
  fi
done

if [[ $FAIL -eq 0 ]]; then
  echo "check-no-fleet-hardcoding: OK"
fi
exit $FAIL
