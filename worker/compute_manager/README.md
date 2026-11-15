# compute_manager

**AWS analog:** Kubernetes (aerekos Compute) · **Port:** `3100`

Project-scoped **tasks** (dockerode) and declarative **Deployments** (rolling update / pause / resume / rollback). SQLite via `aerekos-record`. No production mocks — boot calls `assertNoSkipFakes()` so `SKIP_DOCKER` is refused when `NODE_ENV=production`.

## Status

**MVP / implemented** — task CRUD (create/list/get/stop/start/replace-image/delete), Deployments apply/reconcile, `/health`, `/ready`, `/api/v1/info`, `/metrics`.

**Tutorial:** none under `docs/tutorials`. Console **ComputeManager** screen exists (`conductor/app/screens/ComputeManager`).

## Access

- Direct: `http://localhost:3100/...`
- Conductor proxy: `{CONDUCTOR}/api/services/compute_manager{path}` (JWT or service token)
- Health/ready are also reachable as `{CONDUCTOR}/api/services/compute_manager/health` (and `/ready`) when the proxy is up

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `GET` | `/ready` | Readiness (SQLite) |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`) |
| `POST` | `/api/v1/tasks` | Create task (`name`, `project_id`, `image`, …) |
| `GET` | `/api/v1/tasks` | List (`?project_id=`; optional `refresh=1`) |
| `GET` | `/api/v1/tasks/:id` | Get; optional `refresh=1` syncs from Docker |
| `POST` | `/api/v1/tasks/:id/stop` | Stop container |
| `DELETE` | `/api/v1/tasks/:id` | Remove container (best effort) + row |
| `PUT` | `/api/v1/deployments/:id` | Apply Deployment |
| `GET` | `/api/v1/deployments/:id` | Get Deployment + status |
| `POST` | `/api/v1/deployments/:id/reconcile` | Reconcile once |
| `POST` | `/api/v1/deployments/:id/pause` | Pause rollout |
| `POST` | `/api/v1/deployments/:id/resume` | Resume rollout |
| `POST` | `/api/v1/deployments/:id/rollback` | Rollback to revision |

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/compute_manager.yaml`](../../docs/openapi/compute_manager.yaml). Catalog mirror: [`docs/services/compute_manager.md`](../../docs/services/compute_manager.md).

## SDK / CLI

- **SDK (Node):** `client.compute.list|create|scale|remove(projectId, …)` (tasks). Deployments: `client.proxy('compute_manager', { method, path: '/api/v1/deployments/…', projectId, body })`.
- **CLI:** `aerekos call compute_manager POST "/api/v1/tasks" --project $PID --data '...'` (no dedicated `aerekos compute …` verbs yet).

## Environment

| Variable | Default | Meaning |
|----------|---------|---------|
| `PORT` | `3100` | Listen port |
| `DATABASE_PATH` | `data/compute_manager.db` | Metadata |
| `DOCKER_SOCKET` | `/var/run/docker.sock` | Docker API |
| `COMPUTE_DOCKER_NETWORK` | — | Optional attach network |
| `SKIP_DOCKER` | — | `1` in **tests only**; process exits if set in production |
| `CONDUCTOR_URL` | — | Conductor registration |

## Quick start

```bash
cd worker/compute_manager
cp .env_example .env
npm install   # use Node 20 (.nvmrc)
# Pull a test image first, e.g. docker pull alpine:3.19
npm start
# curl http://localhost:3100/health
```

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | prod guard, deployment controller, docker runtime, … |
| Integration | `npm run test:integration` | supertest; `SKIP_DOCKER=1` via `tests/beforeFile.js` |
| All | `npm test` | unit + integration (Node 20) |
| E2E | [`tests/e2e/README.md`](./tests/e2e/README.md) | live stack + conductor proxy |

## Related

- ADR [`docs/adr/004-aerekos-compute-orchestrator.md`](../../docs/adr/004-aerekos-compute-orchestrator.md)
- Conductor seed / proxy; **DeploymentHandler** / **ServiceManager** for first-party services — this manager is for *user* workloads
