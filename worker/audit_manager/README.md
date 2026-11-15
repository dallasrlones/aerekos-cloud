# audit_manager

**AWS analog:** CloudTrail · **Port:** `3149`

Project-scoped **audit events** (CRUD `/api/v1/events`) with optional `actor` / `action` / `detail`, a convenience **`POST /api/v1/ingest`** writer, and `POST /api/v1/ensure-defaults` (bootstrap event). SQLite via `aerekos-record`. No production skip-fakes in the request path — `SKIP_SERVICE_REGISTRATION` is test/dev only (`createManagerApp` → `assertNoSkipFakes()`).

## Status

**MVP / implemented** — events CRUD, ingest, ensure-defaults, `/health`, `/ready`, `/api/v1/info`, `/metrics`.

**Tutorial:** none standalone. Console uses generic **ManagerConsole** ServiceGuide / ObservabilityPanel for `audit_manager`.

## Access

- Direct: `http://localhost:3149/...`
- Conductor proxy: `{CONDUCTOR}/api/services/audit_manager{path}` (JWT or service token)

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`) |
| `POST` | `/api/v1/ensure-defaults` | Seed bootstrap event if project has none |
| `POST` | `/api/v1/ingest` | Create event from body (`project_id`, optional name/actor/action/detail) |
| `POST` | `/api/v1/events` | Create (`project_id`, `name`, optional actor/action/detail) |
| `GET` | `/api/v1/events` | List (`?project_id=`, optional `?q=`) |
| `GET` | `/api/v1/events/:id` | Get one |
| `PATCH`/`PUT` | `/api/v1/events/:id` | Update |
| `DELETE` | `/api/v1/events/:id` | Delete |

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/audit_manager.yaml`](../../docs/openapi/audit_manager.yaml). Catalog mirror: [`docs/services/audit_manager.md`](../../docs/services/audit_manager.md).

## SDK / CLI

- **SDK (Node):** `client.resource('audit_manager', 'events')` (create/list/get/update/delete).
- **CLI:** `aerekos audit_manager events list|get|create|update|delete --project $PID` (and `-d` JSON for create/update). Ingest via `aerekos call` / curl.

## Quick start

```bash
cd worker/audit_manager
npm install   # use Node 20 (.nvmrc)
npm start
# curl http://localhost:3149/health
```

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | ItemService create/ensureDefaults |
| Integration | `npm run test:integration` | health/ready/info, ingest, CRUD |
| All | `npm test` | unit + integration |
| E2E | [`tests/e2e/README.md`](./tests/e2e/README.md) | proxy + root `e2e/catalog.js` |

## Related

- Conductor registration / proxy · ManagerConsole / ObservabilityPanel
- Root [`GOLDEN_PATH.md`](../../GOLDEN_PATH.md)
