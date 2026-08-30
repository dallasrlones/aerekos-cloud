#!/usr/bin/env bash
# Build + run the worker/conductor test suites inside a Node 20 container so
# results are independent of the host's Node version / better-sqlite3 ABI.
#
#   bash scripts/test-in-docker.sh        # build image + run tests
#   npm run test:docker                   # same, via npm
#
# Used by the husky pre-commit hook.
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT_DIR"

IMAGE="aerekos-cloud-test:local"
BUILD_LOG="$(mktemp -t aerekos-test-build.XXXXXX)"

if ! command -v docker >/dev/null 2>&1; then
  echo "⚠️  Docker not found — cannot run containerized tests." >&2
  exit 1
fi

echo "🐳 Building test image (Node 20)…"
if ! docker build -f docker/Dockerfile.test -t "$IMAGE" . >"$BUILD_LOG" 2>&1; then
  echo "❌ Test image build failed:" >&2
  tail -40 "$BUILD_LOG" >&2
  rm -f "$BUILD_LOG"
  exit 1
fi
rm -f "$BUILD_LOG"

echo "🧪 Running worker + conductor tests in Docker…"
docker run --rm "$IMAGE"
