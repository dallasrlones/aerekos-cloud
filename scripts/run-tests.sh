#!/usr/bin/env bash
# Executed INSIDE the Node 20 test container (docker/Dockerfile.test).
# Runs the worker + conductor Jest suites. The websocket suite is skipped
# because it relies on long-lived sockets that hang in CI.
set -euo pipefail

echo "📦 Testing worker..."
( cd worker && npx jest --testPathPattern=tests --passWithNoTests )

echo "🎼 Testing conductor..."
( cd conductor && npx jest --testPathPattern=tests --testPathIgnorePatterns="websocket" --passWithNoTests )

# Per-manager Jest (only when that package has been npm-installed).
for pkg in git_manager cicd_manager graphql_manager ai_manager backup_manager storage_manager; do
  if [ -d "worker/$pkg/node_modules" ]; then
    echo "🧩 Testing worker/$pkg..."
    ( cd "worker/$pkg" && npx jest --passWithNoTests )
  fi
done

echo "✅ worker + conductor suites passed."
