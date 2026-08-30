#!/usr/bin/env bash
# Start conductor + worker via Docker (weird host ports in docker/e2e.env), then run full E2E.
# Requires: Docker, same auth as other E2E scripts (defaults to admin/admin when unset; see e2e.env).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
E2E_ENV="${ROOT}/docker/e2e.env"
COMPOSE="${ROOT}/docker/e2e-compose.yml"

if [ ! -f "$E2E_ENV" ]; then
  echo "Missing $E2E_ENV" >&2
  exit 1
fi

echo "==> Building & starting aerekos-e2e (conductor + worker)..."
docker compose -f "$COMPOSE" --env-file "$E2E_ENV" up -d --build

set -a
# shellcheck disable=SC1090
. "$E2E_ENV"
set +a

export CONDUCTOR_URL="http://127.0.0.1:${AEREKOS_CONDUCTOR_PORT:-38470}"

# Default login for fresh conductor seed (admin/admin) when caller did not set auth
if [ -z "${AUTH_TOKEN:-}" ] && [ -z "${AUTH_PASSWORD:-}" ]; then
  export AUTH_PASSWORD="${E2E_DEFAULT_AUTH_PASSWORD:-admin}"
  export AUTH_USERNAME="${E2E_DEFAULT_AUTH_USERNAME:-admin}"
  echo "==> No AUTH_TOKEN / AUTH_PASSWORD — using ${AUTH_USERNAME} (see docker/e2e.env)"
fi

export SKIP_DISABLE="${SKIP_DISABLE:-1}"

cd "$ROOT"
echo "==> CONDUCTOR_URL=$CONDUCTOR_URL"
exec bash ./scripts/e2e-everything.sh
