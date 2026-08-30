# End-to-end (E2E) tests

These scripts hit a **real** running conductor and worker (and Docker-backed services). They are **not** a substitute for Jest; they verify the full spine: auth, project/worker, service registry, per-service **conductor proxy**, and (optionally) orchestration features.

## Full-stack suite — `make e2e` (everything, via the conductor)

The Node suite in [`e2e/run.js`](e2e/run.js) exercises **every** manager end-to-end through the
live conductor — the canonical "private AWS" path. It is dependency-free (pure `fetch` + the
[`aerekos-sdk`](aerekos-sdk/README.md)), so it runs on any Node 18+ regardless of the
`better-sqlite3` ABI.

```bash
make up                         # bring up the full stack (docker-compose.full.yml)
make e2e                        # run against http://localhost:3000
CONDUCTOR_PORT=3300 make e2e    # or point at a remapped conductor port
CONDUCTOR_URL=http://host:port npm run e2e:full
```

What it checks (66 checks across 33 managers):

| Tier | Coverage |
|------|----------|
| 0 — Spine | conductor `/health`, JWT login, `/api/services` registry (all 33 managers), `/api/workers` online |
| 1 — Liveness matrix | `GET /api/services/{name}/metrics` for **all 33** managers (proves conductor→manager routing) |
| 2 — P4 CRUD | create→get→update→list→delete for the 19 SQLite CRUD managers |
| 3 — Rich CRUD | `key_manager` (create/list/rotate), `secrets_manager` (encrypt/reveal/delete), `webhook_manager`, `registry_manager` |
| 4 — SDK flows | `aerekos-sdk` drives login, services, workers, secrets round-trip, and the generic proxy |

Exit code is non-zero if any check fails; the summary lists every failure with its HTTP detail.

## Scripted shell suite (core spine + orchestration)

## Prerequisites

- **Conductor** listening on `CONDUCTOR_URL` (default `http://localhost:3000` for ad-hoc runs) with `/health` OK.
- **Worker** registered (same as [`GOLDEN_PATH.md`](GOLDEN_PATH.md)).
- **Docker** on the worker node so `key_manager`, `storage_manager`, and `db_manager` images can start when enabled.
- **Python 3** (for JSON parsing in shell scripts).
- **curl**.

## All-in-Docker (recommended for “run E2E for real”)

The repo ships **`docker/e2e-compose.yml`** (conductor + worker) with **offbeat host ports** so it is less likely to clash with other projects:

| Service (host) | Default port (env) |
|----------------|--------------------|
| Conductor | `38470` (`AEREKOS_CONDUCTOR_PORT` in `docker/e2e.env`) |
| Worker | `38471` (`AEREKOS_WORKER_PORT`) |

The worker and conductor share a deterministic registration token via **`WORKER_REGISTRATION_TOKEN`** in `docker/e2e.env` (conductor stores it; the worker uses the same value as `CONDUCTOR_TOKEN`).

```bash
# One command: up, wait, full E2E (core + orchestration). Default login is admin/admin if you omit auth.
npm run e2e:docker
```

**Bring the stack up only** (then run `npm run e2e:core` yourself with `CONDUCTOR_URL`):

```bash
npm run e2e:docker:up
export CONDUCTOR_URL="http://127.0.0.1:38470"
export AUTH_PASSWORD=admin
export AUTH_USERNAME=admin
npm run e2e:core
```

**Tear down** (containers; keep volumes): `npm run e2e:docker:down`  
**Nuke named volumes (fresh DBs next run)**: `npm run e2e:docker:reset`

The top-level `docker-compose.yml` uses the same default conductor/worker **host** ports (`38470` / `38471`) and non-default Expo mappings for the same reason.

## Authentication

Set **either** a JWT or password login:

```bash
export CONDUCTOR_URL="http://localhost:3000"
export AUTH_TOKEN='...'
```

or:

```bash
export AUTH_PASSWORD='yourpassword'
# optional if not using default seed user "test":
export AUTH_USERNAME='admin'
```

## Commands (from repository root)

| Command | What it does |
|--------|----------------|
| `npm run e2e:core` | Waits for conductor, ensures project + worker, enables **key_manager → storage_manager → db_manager**, then **GET** smoke: registry + proxied API paths. |
| `npm run e2e:orchestration` | [`test-orchestration.sh`](./test-orchestration.sh) only (projects, workers, one service, scaling, pin, load balancer, disable). |
| `npm run e2e` | **`e2e:core` then `e2e:orchestration`** (full scripted E2E in one go). |

### Environment variables

| Variable | Default | Meaning |
|----------|---------|---------|
| `E2E_CONDUCTOR_MAX_WAIT` | `90` | Seconds to wait for `/health` (polling). |
| `E2E_DEPLOY_STABILIZE` | `25` | Sleep after `enable` before smoke (image pull, container start). |
| `E2E_SMOKE_RETRIES` | `12` | Retries if smoke `GET` returns non-200 (deploy still in flight). |
| `E2E_SMOKE_INTERVAL` | `5` | Sleep between retries. |
| `E2E_CLEANUP` | `0` | Set to `1` to **disable** the three services after a successful `e2e:core` run. |
| `SKIP_DISABLE` | `0` | For `test-orchestration.sh` only: `1` skips the final “disable service” step. |

## What “success” means

- **e2e:core** — All six smoke checks return **HTTP 200** (registries and proxied `GET` for keys list, storage projects, db list with `project_id`).
- If you see **503/502** during retries, deployments may still be starting; increase `E2E_DEPLOY_STABILIZE` or retries.

## See also

- [`GOLDEN_PATH.md`](./GOLDEN_PATH.md) — minimal happy path and proxy mental model.
- [`todo.md`](./todo.md) — sprint context.
