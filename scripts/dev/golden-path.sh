#!/usr/bin/env bash
# W15 — local appliance golden path (print steps; optional make/compose).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

RUN="${GOLDEN_PATH_RUN:-0}"

section() { echo ""; echo "== $* =="; }

section "Prerequisites"
cat <<'EOF'
- Docker Desktop or Docker Engine + Compose v2
- Node 20+ (for catalog/docs scripts only; runtime is containerized)
- ~8 GB free RAM for full stack (use docker-compose.core.yml for a smaller slice)
EOF

section "1 — Clone & env"
echo "  cd $ROOT"
echo "  cp conductor/.env_example conductor/.env   # set JWT_SECRET, MASTER_KEY for key_manager"
echo "  cp worker/.env_example worker/.env         # CONDUCTOR_URL when joining a remote conductor"

section "2 — Generate stack (after catalog changes)"
echo "  make gen          # docker-compose.full.yml + Dockerfiles + docs"

section "3 — Host resource detect (worker reports real CPU/RAM)"
echo "  make detect       # writes .worker-host.env"

section "4 — Start full appliance"
if [[ "$RUN" == "1" ]]; then
  make up
else
  echo "  make up           # docker compose -f docker-compose.full.yml up -d --build"
  echo "  # or core only:   docker compose -f docker-compose.core.yml up -d"
  echo "  # auto-run:       GOLDEN_PATH_RUN=1 $0"
fi

section "5 — Verify"
echo "  make health"
echo "  make ps"
echo "  curl -sf http://localhost:\${CONDUCTOR_PORT:-3000}/health | jq ."
echo "  open http://localhost:\${FRONTEND_PORT:-19006}"

section "6 — Auth-aligned dev (matches prod patterns)"
cat <<'EOF'
  Enable auth_manager + key_manager + secrets_manager before storage-dependent flows.
  See docs/runbooks/auth-required.md and docs/architecture/identity.md.
  Mint app token: POST /api/services/auth_manager/api/v1/auth/token (client_credentials).
EOF

section "7 — Tests (optional)"
echo "  make test         # unit tests in Docker"
echo "  make e2e          # full-stack e2e (long; needs live stack)"

section "8 — Tear down"
echo "  make down         # stop containers (volumes preserved)"
echo "  make clean        # DESTROYS volumes — data loss"

section "Devcontainer"
echo "  Open repo in VS Code / Cursor Dev Containers → .devcontainer/devcontainer.json"
echo "  Includes Node LTS + docker-in-docker notes for compose from inside the container."

echo ""
echo "Golden path doc: docs/GA_CHECKLIST.md (W15) · enterprise E39 make golden-path (future target)."
