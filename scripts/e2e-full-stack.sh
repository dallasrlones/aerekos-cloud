#!/usr/bin/env bash
# End-to-end: conductor + worker (already registered) + key_manager + storage_manager + db_manager
# Prereq: Conductor and worker are running; Docker on the worker can pull/run service images.
#
#   export AUTH_PASSWORD='...'   # or AUTH_TOKEN
#   ./scripts/e2e-full-stack.sh
#
# Optional: E2E_CLEANUP=1  — POST disable for the three services at the end
#           AUTH_USERNAME=admin  (default: test, matches test-orchestration)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/e2e-helpers.sh
source "$ROOT/scripts/e2e-helpers.sh"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

CONDUCTOR_URL="${CONDUCTOR_URL:-http://localhost:3000}"
AUTH_USERNAME="${AUTH_USERNAME:-test}"
AUTH_PASSWORD="${AUTH_PASSWORD:-}"
: "${E2E_SMOKE_RETRIES:=12}"
: "${E2E_SMOKE_INTERVAL:=5}"
: "${E2E_DEPLOY_STABILIZE:=25}"

if [ -z "${AUTH_TOKEN:-}" ] && [ -z "$AUTH_PASSWORD" ]; then
  echo -e "${RED}Set AUTH_TOKEN or AUTH_PASSWORD before running.${NC}" >&2
  exit 1
fi

if [ -z "${AUTH_TOKEN:-}" ]; then
  AUTH_TOKEN=$(curl -sS -X POST "${CONDUCTOR_URL}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"${AUTH_USERNAME}\",\"password\":\"${AUTH_PASSWORD}\"}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('token','') or '')" 2>/dev/null || echo "")
fi

if [ -z "$AUTH_TOKEN" ]; then
  echo -e "${RED}Login failed. Check CONDUCTOR_URL, AUTH_USERNAME, AUTH_PASSWORD.${NC}" >&2
  exit 1
fi

api_call() {
  local m=$1
  local ep=$2
  local d=${3-}
  if [ -z "$d" ]; then
    curl -sS -X "$m" "$CONDUCTOR_URL$ep" -H "Authorization: Bearer $AUTH_TOKEN" -H "Content-Type: application/json" 2>/dev/null
  else
    curl -sS -X "$m" "$CONDUCTOR_URL$ep" -H "Authorization: Bearer $AUTH_TOKEN" -H "Content-Type: application/json" -d "$d" 2>/dev/null
  fi
}

echo -e "${BLUE}=== E2E full stack (conductor + core services) ===${NC}\n"
echo -e "${YELLOW}0. Waiting for conductor /health...${NC}"
e2e_wait_conductor || exit 1
echo -e "${GREEN}   ✓ Conductor is up${NC}\n"

echo -e "${YELLOW}1. Project${NC}"
PROJECTS=$(api_call "GET" "/api/projects")
PROJECT_ID=$(echo "$PROJECTS" | python3 -c "import sys,json; d=json.load(sys.stdin); p=d.get('projects') or []; print(p[0]['id'] if p else '')" 2>/dev/null || echo "")
if [ -z "$PROJECT_ID" ]; then
  CREATE=$(api_call "POST" "/api/projects" '{"name":"e2e-full-stack","description":"E2E","enabled":true}')
  PROJECT_ID=$(echo "$CREATE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('project',{}).get('id') or d.get('id',''))" 2>/dev/null || echo "")
fi
if [ -z "$PROJECT_ID" ]; then
  echo -e "${RED}   Could not get project id${NC}" >&2
  exit 1
fi
echo -e "${GREEN}   ✓ project_id=$PROJECT_ID${NC}\n"

echo -e "${YELLOW}2. Worker + project assignment${NC}"
WORKERS=$(api_call "GET" "/api/workers")
WORKER_ID=$(echo "$WORKERS" | python3 -c "import sys,json; d=json.load(sys.stdin); w=d.get('workers') or []; print(w[0]['id'] if w else '')" 2>/dev/null || echo "")
if [ -z "$WORKER_ID" ]; then
  echo -e "${RED}   No workers — start the worker agent and re-run.${NC}" >&2
  exit 1
fi
api_call "POST" "/api/projects/$PROJECT_ID/workers/$WORKER_ID" >/dev/null
echo -e "${GREEN}   ✓ worker $WORKER_ID assigned${NC}\n"

CORE_SVC=(key_manager storage_manager db_manager)
SIDS=()
for cname in "${CORE_SVC[@]}"; do
  echo -e "${YELLOW}3. Enable $cname${NC}"
  sid=$(api_call "GET" "/api/services" | python3 -c "
import json, sys
d = json.load(sys.stdin)
n = sys.argv[1]
for s in d.get('services', []):
  if s.get('name') == n:
    print(s['id'])
    break
" "$cname" 2>/dev/null || echo "")
  if [ -z "$sid" ]; then
    echo -e "${RED}   Service $cname not in conductor DB — run conductor seeding or create service.${NC}" >&2
    exit 1
  fi
  SIDS+=("$sid")
  api_call "POST" "/api/projects/$PROJECT_ID/services/$sid" >/dev/null || true
  EN=$(api_call "POST" "/api/projects/$PROJECT_ID/services/$sid/enable" "{}")
  echo "$EN" | python3 -m json.tool 2>/dev/null || echo "$EN"
  echo -e "${GREEN}   ✓ $cname enable requested (id $sid)${NC}\n"
done

echo -e "${YELLOW}4. Stabilize (${E2E_DEPLOY_STABILIZE}s) for Docker pulls / deploys...${NC}"
sleep "$E2E_DEPLOY_STABILIZE"

smoke_all() {
  e2e_smoke_try "registry key_manager" "/api/services/registry/key_manager" 200 || return 1
  e2e_smoke_try "registry storage_manager" "/api/services/registry/storage_manager" 200 || return 1
  e2e_smoke_try "registry db_manager" "/api/services/registry/db_manager" 200 || return 1
  e2e_smoke_try "proxy key list" "/api/services/key_manager/api/keys?project_id=$PROJECT_ID" 200 || return 1
  e2e_smoke_try "proxy storage projects" "/api/services/storage_manager/api/projects?project_id=$PROJECT_ID" 200 || return 1
  e2e_smoke_try "proxy db list" "/api/services/db_manager/api/databases?project_id=$PROJECT_ID" 200 || return 1
  return 0
}

echo -e "${YELLOW}5. Proxy smoke (conductor → services)${NC}"
attempt=1
rc=0
while [ "$attempt" -le "$E2E_SMOKE_RETRIES" ]; do
  if smoke_all; then
    rc=0
    break
  fi
  rc=1
  echo -e "${YELLOW}   (retry $attempt / $E2E_SMOKE_RETRIES in ${E2E_SMOKE_INTERVAL}s)${NC}"
  attempt=$((attempt + 1))
  sleep "$E2E_SMOKE_INTERVAL"
done

if [ "$rc" -ne 0 ]; then
  echo -e "${RED}E2E smoke failed after retries. Check worker Docker + service logs.${NC}" >&2
  exit 1
fi

echo -e "\n${GREEN}=== E2E full stack smoke OK ===${NC}\n"

if [ "${E2E_CLEANUP:-0}" = "1" ]; then
  echo -e "${YELLOW}6. Cleanup (disable core services)${NC}"
  for i in "${!SIDS[@]}"; do
    api_call "POST" "/api/projects/${PROJECT_ID}/services/${SIDS[$i]}/disable" "{}" || true
  done
  echo -e "${GREEN}   Done${NC}\n"
fi

exit 0
