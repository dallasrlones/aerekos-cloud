#!/usr/bin/env bash
# Executed INSIDE the Node 20 test container (docker/Dockerfile.test).
# Runs the worker + conductor Jest suites, then each manager's own Jest
# suite, then the aerekos-sdk node:test suite.
#
# A failing suite is reported but does NOT stop the run: every suite runs,
# failures are listed at the end, and the script exits non-zero if any
# failed. (The websocket suite is skipped — it relies on long-lived sockets
# that hang in CI.)

set -uo pipefail

FAILURES=()
TOTAL=0
PASS=0

run_suite() {
  local label="$1"; shift
  local cmd="$1"
  TOTAL=$((TOTAL + 1))
  echo ""
  echo "=== $label ==="
  if bash -c "$cmd"; then
    PASS=$((PASS + 1))
    echo "✅ PASS: $label"
  else
    FAILURES+=("$label")
    echo "❌ FAIL: $label"
  fi
}

# Worker root suites.
run_suite "worker" \
  "cd worker && npx jest --testPathPattern=tests --passWithNoTests"

# Conductor suites (skip websocket).
run_suite "conductor" \
  "cd conductor && npx jest --testPathPattern=tests --testPathIgnorePatterns=websocket --passWithNoTests"

# Per-manager Jest (only when that package has been npm-installed).
for pkg in git_manager cicd_manager graphql_manager ai_manager backup_manager storage_manager download_manager auth_manager; do
  if [ -d "worker/$pkg/node_modules" ]; then
    run_suite "worker/$pkg" "cd worker/$pkg && npx jest --passWithNoTests"
  else
    echo ""
    echo "⚠️  skipping worker/$pkg (no node_modules)"
  fi
done

# aerekos-sdk is dependency-free; its tests use node:test, not jest.
run_suite "aerekos-sdk" "cd aerekos-sdk && node --test tests/"

echo ""
echo "=============================================="
echo "Test summary: $PASS/$TOTAL suites passed."
if [ ${#FAILURES[@]} -eq 0 ]; then
  echo "✅ all suites passed."
  exit 0
fi
echo "❌ failing suites:"
for f in "${FAILURES[@]}"; do
  echo "   - $f"
done
exit 1