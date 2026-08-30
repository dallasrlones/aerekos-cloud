#!/usr/bin/env bash
# aerekos-updater loop — pulls releases from the conductor and redeploys.
#
# ROLE:
#   full       — docker-compose.full.yml (unsafe on mixed prod-mini; do not use there)
#   core|conductor — mixed stack: bind-mount restarts + --no-deps manager rebuilds
#   worker     — worker/docker-compose.yml
set -uo pipefail

CONDUCTOR_URL="${CONDUCTOR_URL:?CONDUCTOR_URL required}"
TOKEN="${AEREKOS_AGENT_TOKEN:?AEREKOS_AGENT_TOKEN required}"
HOST_DIR="${HOST_DIR:?HOST_DIR required}"
ROLE="${ROLE:-worker}"
POLL_INTERVAL="${POLL_INTERVAL:-30}"
UPDATER_SERVICE="${UPDATER_SERVICE:-aerekos-updater}"

is_conductor_role() {
  [ "$ROLE" = "core" ] || [ "$ROLE" = "conductor" ]
}

if [ "$ROLE" = "full" ]; then
  PROJECT_DIR="$HOST_DIR"
  COMPOSE_FILE="$HOST_DIR/docker-compose.full.yml"
  HOST_ENV_FILE="${HOST_ENV_FILE:-$HOST_DIR/.worker-host.env}"
elif is_conductor_role; then
  PROJECT_DIR="$HOST_DIR"
  COMPOSE_FILE="$HOST_DIR/docker-compose.core.yml"
  HOST_ENV_FILE="${HOST_ENV_FILE:-$HOST_DIR/.worker-host.env}"
else
  PROJECT_DIR="$HOST_DIR/worker"
  COMPOSE_FILE="$HOST_DIR/worker/docker-compose.yml"
  HOST_ENV_FILE="${HOST_ENV_FILE:-$HOST_DIR/worker/.worker-host.env}"
fi

log() { printf '[updater %s] %s\n' "$(date -u +%H:%M:%SZ)" "$*"; }

hostname_val() {
  if [ -f "$HOST_ENV_FILE" ]; then
    local h; h=$(grep -E '^WORKER_HOSTNAME=' "$HOST_ENV_FILE" | head -1 | cut -d= -f2-)
    [ -n "$h" ] && { echo "$h"; return; }
  fi
  cat /etc/hostname 2>/dev/null || echo unknown
}

current_version() {
  if [ -f "$HOST_DIR/VERSION" ]; then
    jq -r '.version // empty' "$HOST_DIR/VERSION" 2>/dev/null || true
  fi
}

api() {
  curl -fsS --max-time 30 -H "x-aerekos-agent-token: $TOKEN" "$CONDUCTOR_URL$1"
}

c0_ok() {
  curl -fsS --max-time 5 "http://127.0.0.1:3002/api/v1/auth/token" >/dev/null 2>&1 && return 0
  curl -fsS --max-time 5 "http://127.0.0.1:3002/health" >/dev/null 2>&1
}

apply_core() {
  local version="$1"
  log "Conductor-role apply $version (never full.yml, never --remove-orphans)"
  docker restart aerekos-cloud-conductor aerekos-cloud-frontend aerekos-cloud-worker 2>/dev/null || true
  local files=(-f "$HOST_DIR/docker-compose.core.yml")
  if [ -f "$HOST_DIR/docker-compose.platform.yml" ]; then
    files+=(-f "$HOST_DIR/docker-compose.platform.yml")
  fi
  local svcs
  svcs=$(docker compose --project-directory "$HOST_DIR" "${files[@]}" config --services 2>/dev/null \
    | grep -vx "$UPDATER_SERVICE" | grep -vx "auth_manager" | grep -vx "aerekos-updater" | tr '\n' ' ' || true)
  if [ -z "$svcs" ]; then
    log "No manager services to rebuild; bind-mount restart only"
    return 0
  fi
  if ! APP_VERSION="$version" docker compose --project-directory "$HOST_DIR" "${files[@]}" \
       up -d --build --no-deps $svcs; then
    log "ERROR: core/platform compose up failed"
    return 1
  fi
  if c0_ok; then
    log "C0 mint still reachable; leaving auth_manager as-is"
  else
    log "WARN: C0 probe failed after apply; not rebuilding auth_manager"
  fi
}

apply_worker() {
  local version="$1"
  local services
  services=$(docker compose --project-directory "$PROJECT_DIR" -f "$COMPOSE_FILE" config --services 2>/dev/null \
             | grep -vx "$UPDATER_SERVICE" | tr '\n' ' ')
  if [ -z "$services" ]; then log "ERROR: no services resolved from compose"; return 1; fi
  log "Deploying $version: docker compose up -d --build [$services]"
  if ! APP_VERSION="$version" docker compose --project-directory "$PROJECT_DIR" -f "$COMPOSE_FILE" \
       up -d --build $services; then
    log "ERROR: compose up failed for $version"; return 1
  fi
  if [ -f "$HOST_DIR/worker/ai/docker-compose.yml" ] || [ -f "$HOST_DIR/docker-compose.ai.yml" ]; then
    local ai_file=""
    [ -f "$HOST_DIR/docker-compose.ai.yml" ] && ai_file="$HOST_DIR/docker-compose.ai.yml"
    [ -f "$HOST_DIR/worker/ai/docker-compose.yml" ] && ai_file="$HOST_DIR/worker/ai/docker-compose.yml"
    if [ -n "$ai_file" ]; then
      local vllm_state
      vllm_state=$(docker inspect -f '{{.State.Status}}' aerekos-vllm 2>/dev/null || echo missing)
      if [ "$vllm_state" = "running" ]; then
        log "vLLM running — leaving it alone"
      else
        log "vLLM is $vllm_state — not starting it"
      fi
      local ai_svcs
      ai_svcs=$(docker compose -f "$ai_file" config --services 2>/dev/null | grep -vxe 'vllm' | tr '\n' ' ' || true)
      if [ -n "$ai_svcs" ]; then
        docker compose -f "$ai_file" up -d --no-deps $ai_svcs || log "WARN: ai compose --no-deps failed"
      fi
    fi
  fi
}

apply_release() {
  local version="$1" sha="$2" bundle_path="$3"
  local tgz="/tmp/${version}.tar.gz"
  log "Downloading release $version"
  if ! curl -fsS --max-time 600 -H "x-aerekos-agent-token: $TOKEN" -o "$tgz" "$CONDUCTOR_URL$bundle_path"; then
    log "ERROR: download failed for $version"; return 1
  fi
  if [ -n "$sha" ] && [ "$sha" != "null" ]; then
    local got; got=$(sha256sum "$tgz" | awk '{print $1}')
    if [ "$got" != "$sha" ]; then log "ERROR: sha256 mismatch ($got != $sha)"; rm -f "$tgz"; return 1; fi
  fi

  if is_conductor_role; then
    log "Conductor-role waiting 45s so other devices can finish download"
    sleep 45
  fi

  log "Extracting into $HOST_DIR"
  tar xzf "$tgz" -C "$HOST_DIR" || { log "ERROR: extract failed"; rm -f "$tgz"; return 1; }
  rm -f "$tgz"
  printf '{"version":"%s","deployedAt":"%s","role":"%s"}\n' \
    "$version" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$ROLE" > "$HOST_DIR/VERSION"

  if [ "$ROLE" = "full" ]; then
    local services
    services=$(docker compose --project-directory "$PROJECT_DIR" -f "$COMPOSE_FILE" config --services 2>/dev/null \
               | grep -vx "$UPDATER_SERVICE" | tr '\n' ' ')
    APP_VERSION="$version" docker compose --project-directory "$PROJECT_DIR" -f "$COMPOSE_FILE" \
      up -d --build $services || return 1
  elif is_conductor_role; then
    apply_core "$version" || return 1
  else
    apply_worker "$version" || return 1
  fi
  log "Release $version applied."
}

log "started (role=$ROLE, conductor=$CONDUCTOR_URL, host_dir=$HOST_DIR, poll=${POLL_INTERVAL}s)"
while :; do
  HOST="$(hostname_val)"
  CUR="$(current_version)"
  RESP="$(api "/api/releases/check?hostname=$(printf %s "$HOST" | jq -sRr @uri)&current=$(printf %s "$CUR" | jq -sRr @uri)&role=$(printf %s "$ROLE" | jq -sRr @uri)" 2>/dev/null || true)"
  if [ -n "$RESP" ]; then
    UPDATE=$(printf '%s' "$RESP" | jq -r '.update // false' 2>/dev/null)
    if [ "$UPDATE" = "true" ]; then
      VER=$(printf '%s' "$RESP" | jq -r '.version')
      SHA=$(printf '%s' "$RESP" | jq -r '.sha256 // empty')
      BUN=$(printf '%s' "$RESP" | jq -r '.bundle')
      REASON=$(printf '%s' "$RESP" | jq -r '.reason // ""')
      log "Update available -> $VER (reason=$REASON, current=${CUR:-none})"
      apply_release "$VER" "$SHA" "$BUN" || log "update attempt failed; will retry"
    fi
  fi
  sleep "$POLL_INTERVAL"
done
