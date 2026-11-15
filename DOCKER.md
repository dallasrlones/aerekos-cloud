# Docker / Compose Guide

Honest operator map for bringing the platform up. Prefer this over older
“start root `docker-compose.yml` and hope” notes in `QUICK_START.md`.

## Compose files (what each one is)

| File | Role | When to use |
|------|------|-------------|
| `docker-compose.full.yml` | **One-shot** generated stack: conductor + frontend + worker + every manager | Laptop / greenfield demo (`make up`) |
| `docker-compose.core.yml` | Conductor-host **core** managers (prod-mini style) | Mixed/homelab conductor host |
| `docker-compose.platform.yml` | Control-plane extras (RabbitMQ, Redis, queue/function, …) on the **same** network as core | With core; **never** `--remove-orphans` |
| `docker-compose.yml` | Legacy convenience: conductor + frontend + worker (dev Dockerfiles, odd host ports) | Optional local poke; **not** the GA one-shot |
| `docker-compose.headscale.yml` | Fleet mesh (Headscale Layer A) | Fleet VPC only |
| `docker-compose.kms.yml` | Optional KMS sidecar | When explicitly needed |
| `conductor/docker-compose.yml` / `worker/docker-compose.yml` / `worker/<mgr>/docker-compose.yml` | Per-package compose | Split start or extra worker nodes |
| `worker/docker-compose.ai.yml` / `.vllm.yml` / `.download.yml` / `.tailscale.yml` | GPU / download / mesh overlays | Orin / specialty hosts |

`docker-compose.full.yml` is **generated** by `scripts/generate-full-stack.mjs`
from `conductor/api/config/managerServicePorts.js`. After adding a manager:
`make gen`.

## One-shot story (canonical)

```bash
cp .env_example .env          # set JWT_SECRET / WORKER_TOKEN for anything beyond throwaway
make up                       # detect host → docker compose -f docker-compose.full.yml up -d --build
make health
make logs                     # optional
make down
```

- Conductor API: `http://localhost:${CONDUCTOR_PORT:-3000}`
- Dashboard: `http://localhost:${FRONTEND_PORT:-19006}`
- Managers: published ports in `docker-compose.full.yml` comments

Equivalent without Make:

```bash
docker compose -f docker-compose.full.yml up -d --build
```

**Honesty:** `make up` builds **local** images for conductor/worker/managers. It still
needs network the first time for Dockerfile `FROM` bases (see offline bucket below)
and npm rebuilds inside those builds. It does **not** deploy the live fleet, start
Headscale, or pull Orin AI/vLLM images.

### Compose profiles (opt-in)

| Profile | Where | What |
|---------|-------|------|
| `headscale` | `docker-compose.core.yml` | Starts Headscale only when `--profile headscale` is set |
| `sidecar` | `docker-compose.headscale.yml` | Tailscale sidecar; Headscale itself starts without a profile |

Examples:

```bash
docker compose -f docker-compose.core.yml --profile headscale up -d headscale
docker compose -f docker-compose.headscale.yml up -d --no-deps          # headscale
docker compose -f docker-compose.headscale.yml --profile sidecar up -d  # + tailscale
```

## Homelab / prod-mini (not one-shot full)

Mixed stacks intentionally **do not** run `docker-compose.full.yml` on prod-mini.
Use core (+ platform) and never `--remove-orphans`. Details:
[`docs/runbooks/mixed-stack.md`](docs/runbooks/mixed-stack.md),
[`DEPLOYMENT.md`](DEPLOYMENT.md).

```bash
docker compose -f docker-compose.core.yml up -d --build
docker compose -f docker-compose.core.yml -f docker-compose.platform.yml up -d --build --no-deps <svc>
```

Extra worker nodes: `make worker` (needs `worker/.env` with `CONDUCTOR_URL` +
`CONDUCTOR_TOKEN`).

## Registry image cache / offline bucket

### What exists today

- **Local builds** are the default (`build:` contexts). There is no automated
  “mirror every manager to a private registry” in this closeout.
- **External pull images** (RabbitMQ, Redis, Headscale, Tailscale, qBittorrent,
  Jackett, Node/nginx bases) are listed in
  [`docs/ops/offline-images.txt`](docs/ops/offline-images.txt).
- **Helper script** (Wave 9 improvement):
  [`scripts/ops/offline-image-cache.sh`](scripts/ops/offline-image-cache.sh)
  — `list` / `pull` / `save` / `load` a tar bucket for air-gapped hosts.
- **Local registry:2** runbook (live worker task): [`docs/runbooks/local-registry.md`](docs/runbooks/local-registry.md).
- **registry_manager** can `docker load` import tars via API when the manager is up;
  that is not a substitute for pre-seeding bases before first compose build.

### Offline workflow

On a networked machine:

```bash
make images-list
make images-pull
make images-save                  # writes ./offline-image-cache/*.tar
# copy offline-image-cache/ to the air-gapped host
```

On the offline host:

```bash
make images-load CACHE_DIR=./offline-image-cache
make build                        # or make up — still builds local manager images
```

`offline-image-cache/` is gitignored-worthy local state; do not commit tarballs.

### Parked (needs live registry / fleet / GPU)

| Item | Why parked |
|------|------------|
| `registry:2` pull-through + `INTERNAL_REGISTRY` fleet sync | Needs a live worker + insecure-registries + LAN/overlay |
| Pushing built `aerekos-*` manager images to a private registry | Needs registry credentials + fleet policy |
| Orin vLLM / STT / TTS / TTS-cache images | GPU host + large pulls; listed commented in `offline-images.txt` |
| End-to-end air-gap proof on prod-mini | Needs fleet (`ops-gate0`) |

## Network / volumes / health (short)

- Full/core stacks use the `aerekos` (or project-prefixed) bridge network.
- Conductor health: `GET /health`. Managers: `/health` on their service port.
- Worker mounts `/var/run/docker.sock` when the agent must manage containers.
- Production Dockerfiles: prefer `Dockerfile` over `Dockerfile.dev` on conductor
  hosts; frontend in full.yml still uses `Dockerfile.dev` for the dashboard proxy.

## Troubleshooting

| Symptom | Check |
|---------|--------|
| Port in use | `CONDUCTOR_PORT` / `FRONTEND_PORT` / `WORKER_PORT` overrides |
| Manager cannot resolve conductor | Same compose network / alias `aerekos-conductor`; see mixed-stack runbook |
| `--remove-orphans` deleted half the stack | Never use it on mixed core+platform+root compose |
| Offline `FROM` pull fails | `make images-load` first; confirm `node:20-bookworm-slim` present |
| Worker registration fails | `WORKER_TOKEN` / `WORKER_REGISTRATION_TOKEN` match conductor seed |

## Logs / stop

```bash
make logs
make down
make clean          # down -v — destroys named volumes
```
