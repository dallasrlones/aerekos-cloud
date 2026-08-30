#!/usr/bin/env bash
# Shared helpers for E2E shell scripts. Source from repo root: source scripts/e2e-helpers.sh

: "${E2E_CONDUCTOR_MAX_WAIT:=90}"
: "${E2E_CONDUCTOR_INTERVAL:=2}"

e2e_wait_conductor() {
  local base="${1:-$CONDUCTOR_URL}"
  local health="${base%/}/health"
  local max_iters=$((E2E_CONDUCTOR_MAX_WAIT / E2E_CONDUCTOR_INTERVAL))
  [ "$max_iters" -lt 1 ] && max_iters=1
  local n=0
  while [ "$n" -lt "$max_iters" ]; do
    if curl -fsS -o /dev/null --max-time 3 "$health" 2>/dev/null; then
      return 0
    fi
    n=$((n + 1))
    sleep "$E2E_CONDUCTOR_INTERVAL"
  done
  echo "E2E: Conductor not healthy at $health after ~${E2E_CONDUCTOR_MAX_WAIT}s" >&2
  return 1
}

e2e_api_json() {
  local method=$1
  local path=$2
  local data=${3-}
  if [ -z "$data" ]; then
    curl -fsS -X "$method" \
      "$CONDUCTOR_URL$path" \
      -H "Authorization: Bearer $AUTH_TOKEN" \
      -H "Content-Type: application/json" 2>/dev/null
  else
    curl -fsS -X "$method" \
      "$CONDUCTOR_URL$path" \
      -H "Authorization: Bearer $AUTH_TOKEN" \
      -H "Content-Type: application/json" \
      -d "$data" 2>/dev/null
  fi
}

e2e_api_http_code() {
  local method=$1
  local path=$2
  local data=${3-}
  if [ -z "$data" ]; then
    curl -sS -o /dev/null -w '%{http_code}' -X "$method" \
      "$CONDUCTOR_URL$path" \
      -H "Authorization: Bearer $AUTH_TOKEN" \
      -H "Content-Type: application/json" 2>/dev/null || echo "000"
  else
    curl -sS -o /dev/null -w '%{http_code}' -X "$method" \
      "$CONDUCTOR_URL$path" \
      -H "Authorization: Bearer $AUTH_TOKEN" \
      -H "Content-Type: application/json" \
      -d "$data" 2>/dev/null || echo "000"
  fi
}

e2e_get_service_id() {
  local sname=$1
  e2e_api_json "GET" "/api/services" | python3 -c "
import json, sys
name = sys.argv[1]
d = json.load(sys.stdin)
for s in d.get('services', []):
  if s.get('name') == name:
    print(s['id'])
    sys.exit(0)
sys.exit(1)
" "$sname" 2>/dev/null
}

e2e_smoke_try() {
  local desc=$1
  local path=$2
  local want=${3:-200}
  local code
  code=$(e2e_api_http_code "GET" "$path" "")
  if [ "$code" = "$want" ]; then
    echo "   ✓ $desc (HTTP $code)"
    return 0
  fi
  echo "   ✗ $desc — got HTTP $code, expected $want" >&2
  return 1
}

e2e_smoke_try_flexible() {
  local desc=$1
  local path=$2
  local code
  code=$(e2e_api_http_code "GET" "$path" "")
  if [ "$code" = "200" ] || [ "$code" = "201" ] || [ "$code" = "204" ]; then
    echo "   ✓ $desc (HTTP $code)"
    return 0
  fi
  if [ "$code" = "503" ] || [ "$code" = "502" ] || [ "$code" = "000" ]; then
    echo "   ~ $desc — HTTP $code (service may still be deploying)" >&2
    return 2
  fi
  echo "   ✗ $desc — HTTP $code" >&2
  return 1
}
