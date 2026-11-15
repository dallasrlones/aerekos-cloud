# aerekos-cloud — one-command self-hosted cloud
#
# Quick start:
#   make up        # build + start the entire stack (conductor, frontend, worker, all managers)
#   make health    # show health/status of every container
#   make logs      # tail logs for the whole stack
#   make down      # stop everything
#
# The full stack is generated from conductor/api/config/managerServicePorts.js.
# Re-generate after adding a manager with `make gen`.

COMPOSE := docker compose -f docker-compose.full.yml

.PHONY: help gen build up start down restart ps health logs clean dockerfiles e2e test docs docs-serve detect worker catalog-check e2e-icarus-wants e2e-icarus-wants-live images-list images-pull images-save images-load

# Offline image bucket (external pulls only). Override: CACHE_DIR=./my-bucket
CACHE_DIR ?= ./offline-image-cache
IMAGES_SH := bash scripts/ops/offline-image-cache.sh

help:
	@echo "aerekos-cloud targets:"
	@echo "  make detect       Detect this host's real CPU/RAM/disk/network for the worker"
	@echo "  make gen          Regenerate docker-compose.full.yml + manager Dockerfiles"
	@echo "  make docs         Generate service docs + the web docs site from docs/catalog.js"
	@echo "  make docs-serve   Serve the web docs locally on http://localhost:8080"
	@echo "  make build        Build all images"
	@echo "  make worker       Detect host specs + start ONLY a worker (joins a remote conductor)"
	@echo "  make up           Build + start the full stack (detached)"
	@echo "  make down         Stop and remove the stack"
	@echo "  make restart      Restart the stack"
	@echo "  make ps           List stack containers"
	@echo "  make health       Show health status of every container"
	@echo "  make logs         Tail logs for the whole stack"
	@echo "  make images-list  List external images for offline cache (docs/ops/offline-images.txt)"
	@echo "  make images-pull  docker pull those images (needs network)"
	@echo "  make images-save  docker save → \$$(CACHE_DIR) (default ./offline-image-cache)"
	@echo "  make images-load  docker load from \$$(CACHE_DIR) on an air-gapped host"
	@echo "  make test         Run worker + conductor unit tests in Docker (Node 20)"
	@echo "  make e2e          Run the full-stack E2E suite against the live conductor"
	@echo "  make clean        Stop stack and remove volumes (DESTROYS DATA)"

catalog-check:
	node scripts/check-catalog.mjs

gen: dockerfiles docs catalog-check
	node scripts/generate-full-stack.mjs

# Detect the real host machine's resources so the worker reports them instead of
# the Docker VM's. Writes .worker-host.env, which docker-compose feeds to the worker.
detect:
	bash worker/detect-host-resources.sh .worker-host.env

# Start ONLY a worker agent on this machine and join an existing (possibly remote)
# conductor. Requires worker/.env with CONDUCTOR_URL + CONDUCTOR_TOKEN. Detects the
# real host specs automatically. Use this on every extra node you want in the fleet.
worker:
	cd worker && ./up.sh

dockerfiles:
	node worker/scripts/standardize-dockerfiles.mjs

docs:
	node scripts/gen-docs.mjs
	node scripts/gen-platform-tools.mjs

docs-serve: docs
	@echo "Serving docs at http://localhost:$${DOCS_PORT:-8080} (Ctrl-C to stop)"
	cd docs/site && python3 -m http.server $${DOCS_PORT:-8080}

build:
	$(COMPOSE) build

# External image cache / offline bucket — see DOCKER.md + docs/ops/offline-images.txt
images-list:
	$(IMAGES_SH) list

images-pull:
	$(IMAGES_SH) pull

images-save:
	$(IMAGES_SH) save "$(CACHE_DIR)"

images-load:
	$(IMAGES_SH) load "$(CACHE_DIR)"

up: detect
	$(COMPOSE) up -d --build
	@echo ""
	@echo "Conductor API : http://localhost:$${CONDUCTOR_PORT:-3000}"
	@echo "Dashboard     : http://localhost:$${FRONTEND_PORT:-19006}"
	@echo "Run 'make health' to watch services come online."

start: detect
	$(COMPOSE) up -d

down:
	$(COMPOSE) down

restart: down up

ps:
	$(COMPOSE) ps

health:
	$(COMPOSE) ps --format 'table {{.Name}}\t{{.Status}}\t{{.Ports}}'

logs:
	$(COMPOSE) logs -f --tail=50

# Full-stack end-to-end suite. Override CONDUCTOR_URL or CONDUCTOR_PORT as needed:
#   make e2e                                  # http://localhost:3000
#   CONDUCTOR_PORT=3300 make e2e              # http://localhost:3300
#   CONDUCTOR_URL=http://host:port make e2e
e2e:
	CONDUCTOR_URL="$${CONDUCTOR_URL:-http://localhost:$${CONDUCTOR_PORT:-3000}}" node e2e/run.js

# Icarus wants W1–W4 matrix (offline: CorpusStore + nav catalog mocks only)
e2e-icarus-wants:
	ICARUS_C0_SKIP_LIVE=1 node e2e/icarus-wants-matrix.js

e2e-icarus-wants-live:
	node e2e/icarus-wants-matrix.js

# Run the worker + conductor Jest suites in a Node 20 container (matches CI).
test:
	bash scripts/test-in-docker.sh

clean:
	$(COMPOSE) down -v
