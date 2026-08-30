#!/usr/bin/env bash
# Bootstrap auth + conductor secrets in secrets_manager (real KMS via key_manager).
#
# Prerequisites:
#   - conductor, key_manager, secrets_manager running on this host
#   - .env contains KEY_MANAGER_MASTER_KEY (64 hex), DEFAULT_PROJECT_ID
#
# Usage (on prod-mini):
#   bash scripts/bootstrap/auth-secrets.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

# shellcheck disable=SC1091
[ -f .env ] && set -a && source .env && set +a

CONDUCTOR_URL="${CONDUCTOR_URL:-http://localhost:${CONDUCTOR_PORT:-3300}}"
PROJECT_ID="${DEFAULT_PROJECT_ID:-${PROJECT_ID:-}}"
ADMIN_USER="${AEREKOS_ADMIN_USER:-admin}"
ADMIN_PASS="${AEREKOS_ADMIN_PASS:-admin}"
ENVELOPE_KEY="${SECRETS_ENCRYPTION_KEY_NAME:-secrets-envelope-key}"

log()  { printf '\033[1;36m▶ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

[ -n "$PROJECT_ID" ] || die "Set DEFAULT_PROJECT_ID in .env (development project UUID)"

log "Waiting for conductor at $CONDUCTOR_URL"
for i in $(seq 1 30); do
  curl -fsS "$CONDUCTOR_URL/health" >/dev/null 2>&1 && break
  [ "$i" -eq 30 ] && die "conductor not healthy"
  sleep 2
done

log "Admin login"
ADMIN_TOK="$(curl -fsS -X POST "$CONDUCTOR_URL/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")"

auth_hdr=(-H "Authorization: Bearer $ADMIN_TOK" -H 'Content-Type: application/json')

PROJ_Q="project_id=$PROJECT_ID"

log "Ensure envelope key '$ENVELOPE_KEY' in key_manager"
if ! curl -fsS "${auth_hdr[@]}" \
  "$CONDUCTOR_URL/api/services/key_manager/api/keys/$ENVELOPE_KEY?$PROJ_Q" >/dev/null 2>&1; then
  curl -fsS -X POST "${auth_hdr[@]}" \
    "$CONDUCTOR_URL/api/services/key_manager/api/keys?$PROJ_Q" \
    -d "{\"name\":\"$ENVELOPE_KEY\",\"type\":\"symmetric\",\"algorithm\":\"AES-256-GCM\",\"metadata\":{\"purpose\":\"secrets envelope\"}}" \
    | python3 -m json.tool >/dev/null
  log "Created envelope key"
else
  log "Envelope key already exists"
fi

secret_exists() {
  local name="$1"
  curl -fsS "${auth_hdr[@]}" \
    "$CONDUCTOR_URL/api/services/secrets_manager/api/v1/secrets?$PROJ_Q" \
    | python3 -c "import sys,json; names={s['name'] for s in json.load(sys.stdin).get('secrets',[])}; sys.exit(0 if '$name' in names else 1)" \
    2>/dev/null
}

store_secret() {
  local name="$1" value="$2"
  if secret_exists "$name"; then
    log "Secret '$name' already exists — skipping"
    return 0
  fi
  local payload
  payload="$(python3 -c "import json,sys; print(json.dumps({'name':sys.argv[1],'value':sys.argv[2],'project_id':sys.argv[3]}))" "$name" "$value" "$PROJECT_ID")"
  curl -fsS -X POST "${auth_hdr[@]}" \
    "$CONDUCTOR_URL/api/services/secrets_manager/api/v1/secrets?$PROJ_Q" \
    -d "$payload" \
    >/dev/null
  log "Stored secret '$name'"
}

SIGNING_SECRET="${AUTH_MANAGER_SECRET:-}"
CLIENT_SECRET="${CONDUCTOR_CLIENT_SECRET:-}"
if [ -z "$SIGNING_SECRET" ]; then
  SIGNING_SECRET="$(openssl rand -hex 32)"
  log "Generated new auth_manager.signing_secret"
fi
if [ -z "$CLIENT_SECRET" ]; then
  CLIENT_SECRET="$(openssl rand -hex 32)"
  log "Generated new conductor.client_secret"
fi

store_secret "auth_manager.signing_secret" "$SIGNING_SECRET"
store_secret "conductor.client_secret" "$CLIENT_SECRET"

log "Bootstrap complete for project $PROJECT_ID"
log "Next: remove AUTH_MANAGER_SECRET from .env, set SECRETS_MANAGER_URL + DEFAULT_PROJECT_ID, restart conductor + auth_manager"
