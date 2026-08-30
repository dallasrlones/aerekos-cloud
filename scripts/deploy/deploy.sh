#!/usr/bin/env bash
# scripts/deploy/deploy.sh — on-device deploy for aerekos-cloud.
#
# Run by the self-hosted GitHub Actions runner on each device (see
# .github/workflows/deploy.yml), or manually on a device.
#
#     bash scripts/deploy/deploy.sh core      # conductor host slim stack (prod-mini)
#     bash scripts/deploy/deploy.sh full      # all managers (lab only — avoid on mixed homelab)
#     bash scripts/deploy/deploy.sh worker    # worker agent (dev-mini, oculus)
#     bash scripts/deploy/deploy.sh ai        # GPU ai_manager only (oculus)
#     bash scripts/deploy/deploy.sh ai-vllm   # vLLM server + ai_manager (oculus)
#
# How code reaches the device:
#   • In CI, the runner has already checked out the exact commit. This script
#     rsyncs that checkout into the canonical deploy dir (default
#     ~/work/aerekos/aerekos-cloud) — so devices need NO git remote / GitHub
#     credentials of their own. Device-local files (.env, worker/.env,
#     .worker-host.env, data/, node_modules/) are preserved.
#   • Run by hand from a git clone, it git-pulls instead.
#   • Run by hand from the rsync'd dir with no source, it just rebuilds what's
#     already on disk.
#
# Running from the canonical dir keeps the docker compose project name (and your
# named volumes / data) stable across deploys.
#
# Roles:
#   core    conductor + frontend + local worker + locally-enabled managers (docker-compose.core.yml)
#   full    conductor + frontend + local worker + all managers (docker-compose.full.yml)
#   worker  a single worker agent that joins a remote conductor (worker/docker-compose.yml)
#   ai      GPU ai_manager only (worker/docker-compose.ai.yml)
#   ai-vllm vLLM + ai_manager (do not use if vLLM is already healthy)
set -euo pipefail

ROLE="${1:-${AEREKOS_ROLE:-worker}}"
DEPLOY_DIR="${AEREKOS_DEPLOY_DIR:-$HOME/work/aerekos/aerekos-cloud}"
SRC="${GITHUB_WORKSPACE:-}"          # the runner's fresh checkout, when in CI
REF="${AEREKOS_REF:-${GITHUB_SHA:-}}"
HEALTH_TIMEOUT="${AEREKOS_HEALTH_TIMEOUT:-180}"

log()  { printf '\033[1;36m▶ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

command -v docker >/dev/null 2>&1 || die "docker not found on PATH"
docker compose version >/dev/null 2>&1 || die "docker compose v2 plugin not available"

# --- get the code onto the device + resolve the deployed version -----------
VERSION_SHA=""
if [ -n "$SRC" ] && [ -d "$SRC" ] && [ "$SRC" != "$DEPLOY_DIR" ]; then
  # CI mode: mirror the runner's checkout into the canonical dir, keeping the
  # device's own secrets/data/build artifacts.
  command -v rsync >/dev/null 2>&1 || die "rsync required for CI deploy but not found"
  log "Syncing checkout → $DEPLOY_DIR"
  mkdir -p "$DEPLOY_DIR"
  rsync -a --delete \
    --exclude='.git/' \
    --exclude='.env' --exclude='.env.*' \
    --exclude='.worker-host.env' \
    --exclude='data/' \
    --exclude='node_modules/' \
    --exclude='.expo/' \
    --exclude='coverage/' \
    "$SRC"/ "$DEPLOY_DIR"/
  VERSION_SHA="$(git -C "$SRC" rev-parse --short HEAD 2>/dev/null || true)"
  [ -z "$VERSION_SHA" ] && [ -n "$REF" ] && VERSION_SHA="${REF:0:7}"
elif [ -d "$DEPLOY_DIR/.git" ]; then
  # Manual mode on a real git clone.
  log "Syncing $DEPLOY_DIR (git)"
  cd "$DEPLOY_DIR"
  git fetch --prune origin
  if [ -n "$REF" ]; then
    git reset --hard "$REF" 2>/dev/null || { git fetch origin "$REF" && git reset --hard "$REF"; }
  else
    B="$(git rev-parse --abbrev-ref HEAD)"; [ "$B" = "HEAD" ] && B=main
    git reset --hard "origin/${B}"
  fi
  VERSION_SHA="$(git rev-parse --short HEAD)"
else
  # No source to sync from — redeploy whatever is already on disk.
  [ -d "$DEPLOY_DIR" ] || die "Deploy dir '$DEPLOY_DIR' does not exist. See DEPLOYMENT.md."
  warn "No source checkout and $DEPLOY_DIR is not a git clone — rebuilding code already on disk."
  VERSION_SHA="$(cat "$DEPLOY_DIR/VERSION" 2>/dev/null | sed -n 's/.*"version":"\([^"]*\)".*/\1/p' || true)"
fi

cd "$DEPLOY_DIR"
[ -z "$VERSION_SHA" ] && VERSION_SHA="manual"
# Allow callers to pin the stamped version (manual rsync → prod pushes).
if [ -n "${APP_VERSION_OVERRIDE:-}" ]; then
  VERSION_SHA="$APP_VERSION_OVERRIDE"
fi
export APP_VERSION="$VERSION_SHA"
# The updater sidecar mounts the repo at its real host path so compose
# bind-mounts / build contexts resolve correctly when it redeploys.
export AEREKOS_HOST_DIR="$DEPLOY_DIR"
printf '{"version":"%s","deployedAt":"%s","role":"%s"}\n' \
  "$VERSION_SHA" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$ROLE" > "$DEPLOY_DIR/VERSION"
log "Deploying version $APP_VERSION (role=$ROLE)"

# --- helpers ----------------------------------------------------------------
wait_healthy() {
  local name="$1" timeout="$2" waited=0 status
  while :; do
    if ! docker inspect "$name" >/dev/null 2>&1; then
      status="absent"
    else
      status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$name" 2>/dev/null || echo unknown)"
    fi
    case "$status" in
      healthy|running) log "  $name → $status"; return 0 ;;
    esac
    if [ "$waited" -ge "$timeout" ]; then
      warn "  $name not healthy after ${timeout}s (last status: $status)"
      docker logs --tail 30 "$name" 2>&1 | sed 's/^/    /' || true
      return 1
    fi
    sleep 5; waited=$((waited + 5))
  done
}

summary() {
  [ -n "${GITHUB_STEP_SUMMARY:-}" ] || return 0
  {
    echo "### Deploy — role \`$ROLE\` on \`$(hostname -s 2>/dev/null || hostname)\`"
    echo ""
    echo "- version: \`$APP_VERSION\`"
    echo ""
    echo '```'
    eval "$1" 2>&1 || true
    echo '```'
  } >> "$GITHUB_STEP_SUMMARY"
}

# --- deploy per role --------------------------------------------------------
case "$ROLE" in
  core)
    [ -f .env ] || die "Missing $DEPLOY_DIR/.env — copy .env_example and set secrets (see DEPLOYMENT.md)."
    log "Detecting host resources"
    bash worker/detect-host-resources.sh .worker-host.env || warn "host detect failed; worker will fall back to container values"
    log "Building & starting the core stack"
    docker compose -f docker-compose.core.yml up -d --build
    log "Waiting for core services (timeout ${HEALTH_TIMEOUT}s)"
    rc=0
    wait_healthy aerekos-conductor "$HEALTH_TIMEOUT" || rc=1
    wait_healthy aerekos-worker    "$HEALTH_TIMEOUT" || rc=1
    wait_healthy aerekos-auth_manager "$HEALTH_TIMEOUT" || rc=1
    wait_healthy aerekos-frontend  30 || true
    docker compose -f docker-compose.core.yml ps
    summary "docker compose -f docker-compose.core.yml ps"
    [ "$rc" -eq 0 ] || die "One or more core services failed to become healthy."
    ;;

  full)
    [ -f .env ] || die "Missing $DEPLOY_DIR/.env — copy .env_example and set secrets (see DEPLOYMENT.md)."
    log "Detecting host resources"
    bash worker/detect-host-resources.sh .worker-host.env || warn "host detect failed; worker will fall back to container values"
    log "Building & starting the full stack (never --remove-orphans — mixed compose on prod-mini)"
    docker compose -f docker-compose.full.yml up -d --build
    log "Waiting for core services (timeout ${HEALTH_TIMEOUT}s)"
    rc=0
    wait_healthy aerekos-conductor "$HEALTH_TIMEOUT" || rc=1
    wait_healthy aerekos-worker    "$HEALTH_TIMEOUT" || rc=1
    wait_healthy aerekos-frontend  30 || true   # Expo dev server has no healthcheck
    docker compose -f docker-compose.full.yml ps
    summary "docker compose -f docker-compose.full.yml ps"
    [ "$rc" -eq 0 ] || die "One or more core services failed to become healthy."
    ;;

  worker)
    [ -f worker/.env ] || die "Missing $DEPLOY_DIR/worker/.env — set CONDUCTOR_URL + CONDUCTOR_TOKEN (see DEPLOYMENT.md)."
    log "Detecting host resources"
    ( cd worker && bash detect-host-resources.sh .worker-host.env ) || warn "host detect failed; worker will fall back to container values"
    log "Building & starting the worker"
    ( cd worker && APP_VERSION="$APP_VERSION" docker compose up -d --build )
    log "Waiting for the worker (timeout ${HEALTH_TIMEOUT}s)"
    rc=0
    wait_healthy aerekos-worker "$HEALTH_TIMEOUT" || rc=1
    ( cd worker && docker compose ps )
    summary "cd worker && docker compose ps"
    [ "$rc" -eq 0 ] || die "Worker failed to become healthy."
    ;;

  ai)
    [ -f worker/.env ] || die "Missing $DEPLOY_DIR/worker/.env — set CONDUCTOR_URL + CONDUCTOR_TOKEN."
    log "Building & starting ai_manager (GPU host)"
    ( cd worker && APP_VERSION="$APP_VERSION" docker compose -p aerekos-ai -f docker-compose.ai.yml up -d --build )
    rc=0
    wait_healthy aerekos-ai_manager "$HEALTH_TIMEOUT" || rc=1
    ( cd worker && docker compose -p aerekos-ai -f docker-compose.ai.yml ps )
    summary "cd worker && docker compose -p aerekos-ai -f docker-compose.ai.yml ps"
    [ "$rc" -eq 0 ] || die "ai_manager failed to become healthy."
    ;;

  ai-vllm)
    [ -f worker/.env ] || die "Missing $DEPLOY_DIR/worker/.env — set CONDUCTOR_URL + CONDUCTOR_TOKEN."
    log "Starting vLLM server (GPU host)"
    ( cd worker && docker compose -f docker-compose.vllm.yml up -d )
    VLLM_HEALTH_TIMEOUT="${VLLM_HEALTH_TIMEOUT:-1800}"
    log "Waiting for vLLM /health (timeout ${VLLM_HEALTH_TIMEOUT}s — first model load can take 20+ min)"
    vrc=0
    waited=0
    while [ "$waited" -lt "$VLLM_HEALTH_TIMEOUT" ]; do
      if curl -fsS http://127.0.0.1:8000/health >/dev/null 2>&1 \
        || curl -fsS http://127.0.0.1:8000/v1/models >/dev/null 2>&1; then
        log "  vLLM → healthy"
        break
      fi
      sleep 5
      waited=$((waited + 5))
    done
    if [ "$waited" -ge "$VLLM_HEALTH_TIMEOUT" ]; then
      warn "vLLM not healthy after ${VLLM_HEALTH_TIMEOUT}s — check docker logs aerekos-vllm"
      docker logs --tail 40 aerekos-vllm 2>&1 | sed 's/^/    /' || true
      vrc=1
    fi
    log "Building & starting ai_manager (GPU host)"
    ( cd worker && APP_VERSION="$APP_VERSION" docker compose -p aerekos-ai -f docker-compose.ai.yml up -d --build )
    rc=0
    wait_healthy aerekos-ai_manager "$HEALTH_TIMEOUT" || rc=1
    ( cd worker && docker compose -p aerekos-ai -f docker-compose.ai.yml ps )
    docker ps --filter name=aerekos-vllm --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' || true
    summary "cd worker && docker compose -p aerekos-ai -f docker-compose.ai.yml ps"
    [ "$vrc" -eq 0 ] || die "vLLM failed to become healthy."
    [ "$rc" -eq 0 ] || die "ai_manager failed to become healthy."
    ;;

  *)
    die "Unknown role '$ROLE' (expected: core | full | worker | ai | ai-vllm)"
    ;;
esac

log "Deploy complete (role=$ROLE, version=$APP_VERSION)"
