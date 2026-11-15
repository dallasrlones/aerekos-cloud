# billing_manager

**AWS analog:** Cost Explorer · **Port:** `3138`

Project-scoped **usage meters** (CRUD `/api/v1/meters`) plus `POST /api/v1/evaluate-quota` that uses real meter values and **denies when over limit**. Responses never include `{ unlimited: true }`. `POST /api/v1/ensure-defaults` seeds default meters (`storage_bytes`, `compute_tasks`, `git_repos`, `manager_writes`, `compute_seconds`). SQLite via `aerekos-record`. No production mocks — `createManagerApp` → `assertNoSkipFakes()` refuses skip-fake flags when `NODE_ENV=production`.

## Status

**MVP / implemented** — meters CRUD, evaluate-quota, ensure-defaults, `/health`, `/ready`, `/api/v1/info`, `/metrics`.

**Tutorial:** none standalone. Console uses generic **ManagerConsole** for `billing_manager` (no dedicated BillingManager ServiceGuide).

## Access

- Direct: `http://localhost:3138/...`
- Conductor proxy: `{CONDUCTOR}/api/services/billing_manager{path}` (JWT or service token)

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`) |
| `POST` | `/api/v1/ensure-defaults` | Seed default meters if missing |
| `POST` | `/api/v1/evaluate-quota` | Evaluate quota (`allowed` / `remaining`; never unlimited) |
| `POST` | `/api/v1/meters` | Create (`project_id`, `name`, optional `unit` / `value` / `limit`) |
| `GET` | `/api/v1/meters` | List (`?project_id=`) |
| `GET` | `/api/v1/meters/:id` | Get one |
| `PATCH`/`PUT` | `/api/v1/meters/:id` | Update |
| `DELETE` | `/api/v1/meters/:id` | Delete |

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/billing_manager.yaml`](../../docs/openapi/billing_manager.yaml). Catalog mirror: [`docs/services/billing_manager.md`](../../docs/services/billing_manager.md).

## SDK / CLI

- **SDK (Node):** generic `client.resource('billing_manager', 'meters')` / `client.proxy`.
- **CLI:** `aerekos billing_manager meters list|get|create|update|delete --project $PID` (and `-d` / `--data` JSON). Evaluate-quota via `aerekos call` or curl.

## Quick start

```bash
cd worker/billing_manager
npm install   # use Node 20 (.nvmrc)
npm start
# curl http://localhost:3138/health
```

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | prod skip-fake guard + bootstrap wiring |
| Integration | `npm run test:integration` | health/ready/info, CRUD, evaluate-quota |
| All | `npm test` | unit + integration |
