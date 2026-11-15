# status_manager

**AWS analog:** Statuspage · **Port:** `3150`

Project-scoped **status incidents** (CRUD `/api/v1/incidents`) plus `POST /api/v1/ensure-defaults` (seeds `all-clear` when empty) and `GET /api/v1/public` (aggregate `ok` / `degraded` from non-resolved incidents). SQLite via `aerekos-record`. Statuspage is a **naming analog only** — not Atlassian Statuspage. No production mocks — `assertNoSkipFakes()` + `createManagerApp` refuse skip-fake flags when `NODE_ENV=production`.

## Status / honesty

| Claim | Reality |
|-------|---------|
| Incidents CRUD | Real SQLite via `/api/v1/incidents` |
| Public page | `GET /api/v1/public?project_id=` → `{ status, incidents }` (local aggregate) |
| Statuspage parity | Naming analog only — no Atlassian Statuspage / subscriber notify |
| Prod mocks | No skip-fake flags when `NODE_ENV=production` |
| Tutorial | **None** standalone — console generic **ManagerConsole** (no `CONSOLE_GUIDES` entry) |

## Access

- Direct: `http://localhost:3150/...`
- Conductor proxy: `{CONDUCTOR}/api/services/status_manager{path}` (JWT or service token)

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`) |
| `POST` | `/api/v1/ensure-defaults` | Seed `all-clear` if missing |
| `GET` | `/api/v1/public` | Aggregate status (`?project_id=`) |
| `POST` | `/api/v1/incidents` | Create (`project_id`, `name`, optional severity/message/state) |
| `GET` | `/api/v1/incidents` | List (`?project_id=`) |
| `GET` | `/api/v1/incidents/:id` | Get one |
| `PATCH`/`PUT` | `/api/v1/incidents/:id` | Update |
| `DELETE` | `/api/v1/incidents/:id` | Delete |

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/status_manager.yaml`](../../docs/openapi/status_manager.yaml). Catalog: [`docs/services/status_manager.md`](../../docs/services/status_manager.md).

## SDK / CLI

- **SDK (Node):** `client.resource('status_manager', 'incidents')` (create/list/get/update/delete). Public via SDK/`aerekos call` / curl.
- **CLI:** `aerekos status_manager incidents list|get|create|update|delete --project $PID` (and `-d` JSON), or generic `aerekos call`.

## Quick start

```bash
cd worker/status_manager
cp .env_example .env   # optional
npm install            # Node 20+
npm start
# curl http://localhost:3150/health
```

## Environment

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | `3150` | Listen port |
| `DATABASE_PATH` | `data/status_manager.db` | Catalog SQLite file |
| `SKIP_SERVICE_REGISTRATION` | unset | `true` in tests |
| `CONDUCTOR_URL` | unset | Optional auto-registration |
| `CONDUCTOR_TOKEN` / `SERVICE_TOKEN` | unset | Auth for registration |

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | prod skip-fake guard + bootstrap wiring |
| Integration | `npm run test:integration` | health/ready/info/metrics + CRUD + public |
| All | `npm test` | unit + integration |
| Live e2e | needs conductor | Proxy path parked; root `e2e/catalog.js` lists CRUD |

## Related

- Conductor seed / `managerServicePorts` → `3150`
- Root [`GOLDEN_PATH.md`](../../GOLDEN_PATH.md)
