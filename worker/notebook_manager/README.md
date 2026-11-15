# notebook_manager

**AWS analog:** SageMaker notebook · **Port:** `3142`

Project-scoped **notebook** records (CRUD `/api/v1/notebooks`) plus `POST /api/v1/ensure-defaults` (seeds `lab` when empty) and `POST /api/v1/notebooks/:id/run` (compute_manager oneshot via conductor). SQLite via `aerekos-record`. No production mocks — `createManagerApp` → `assertNoSkipFakes()` refuses skip-fake flags when `NODE_ENV=production`.

## Status

**MVP / implemented** — notebooks CRUD, ensure-defaults, run (oneshot dispatch or honest queue), `/health`, `/ready`, `/api/v1/info`, `/metrics`.

**Parked:** live conductor + `compute_manager` e2e for run; interactive Jupyter/lab beyond oneshot dispatch.

**Tutorial:** none standalone. Console uses generic **ManagerConsole** for `notebook_manager`.

## Access

- Direct: `http://localhost:3142/...`
- Conductor proxy: `{CONDUCTOR}/api/services/notebook_manager{path}` (JWT or service token)

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`) |
| `POST` | `/api/v1/ensure-defaults` | Seed default notebook if missing |
| `POST` | `/api/v1/notebooks` | Create (`project_id`, `name`, optional `image` / `url` / `status`) |
| `GET` | `/api/v1/notebooks` | List (`?project_id=`) |
| `GET` | `/api/v1/notebooks/:id` | Get one |
| `PATCH`/`PUT` | `/api/v1/notebooks/:id` | Update |
| `DELETE` | `/api/v1/notebooks/:id` | Delete |
| `POST` | `/api/v1/notebooks/:id/run` | Run via compute oneshot; queues if `CONDUCTOR_URL` unset |

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/notebook_manager.yaml`](../../docs/openapi/notebook_manager.yaml). Catalog mirror: [`docs/services/notebook_manager.md`](../../docs/services/notebook_manager.md).

## SDK / CLI

- **SDK (Node):** generic `client.resource('notebook_manager', 'notebooks')` / `client.proxy`.
- **CLI:** `aerekos notebook_manager notebooks list|get|create|update|delete --project $PID` (and `-d` / `--data` JSON). Run via `aerekos call` or curl.

## Quick start

```bash
cd worker/notebook_manager
npm install   # use Node 20
npm start
# curl http://localhost:3142/health
```

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | prod skip-fake guard + bootstrap wiring |
| Integration | `npm run test:integration` | health/ready/info/metrics + CRUD + run-queue |
| All | `npm test` | unit + integration |
| E2E | [`tests/e2e/README.md`](./tests/e2e/README.md) | live proxy parked; port in root `e2e/catalog.js` |
