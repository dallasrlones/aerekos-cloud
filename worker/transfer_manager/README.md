# transfer_manager

**AWS analog:** Transfer Family · **Port:** `3148`

Project-scoped **SFTP-style endpoint** metadata (CRUD `/api/v1/endpoints`) plus `POST /api/v1/ensure-defaults` (seeds `sftp` when empty), `POST /api/v1/endpoints/:id/put`, and `POST /api/v1/endpoints/:id/get` (object copy through `storage_manager` via conductor). SQLite via `aerekos-record`. No production mocks — `assertNoSkipFakes()` + `createManagerApp` refuse skip-fake flags when `NODE_ENV=production`.

## Status

**MVP / implemented** — endpoints CRUD, ensure-defaults, put/get via storage proxy, `/health`, `/ready`, `/api/v1/info`, `/metrics`.

**Parked:** live conductor proxy e2e (needs stack + enabled `transfer_manager` + `storage_manager` on a non-prod project). **Not** a live SFTP daemon — Transfer Family naming analog only; put/get need `CONDUCTOR_URL` (or `CONDUCTOR_INTERNAL_BASE_URL`).

**Tutorial:** none standalone. Console uses generic **ManagerConsole** for `transfer_manager` (no dedicated TransferManager ServiceGuide).

## Access

- Direct: `http://localhost:3148/...`
- Conductor proxy: `{CONDUCTOR}/api/services/transfer_manager{path}` (JWT or service token)

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`) |
| `POST` | `/api/v1/ensure-defaults` | Seed default `sftp` endpoint if missing |
| `POST` | `/api/v1/endpoints` | Create (`project_id`, `name`, optional `bucket` / `protocol`) |
| `GET` | `/api/v1/endpoints` | List (`?project_id=`) |
| `GET` | `/api/v1/endpoints/:id` | Get one |
| `PATCH`/`PUT` | `/api/v1/endpoints/:id` | Update |
| `DELETE` | `/api/v1/endpoints/:id` | Delete |
| `POST` | `/api/v1/endpoints/:id/put` | Write object via storage_manager |
| `POST` | `/api/v1/endpoints/:id/get` | Read object via storage_manager |

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/transfer_manager.yaml`](../../docs/openapi/transfer_manager.yaml). Catalog mirror: [`docs/services/transfer_manager.md`](../../docs/services/transfer_manager.md).

## SDK / CLI

- **SDK (Node):** generic `client.resource('transfer_manager', 'endpoints')` / `client.proxy`; put/get via proxy paths.
- **CLI:** `aerekos transfer_manager endpoints list|get|create|update|delete --project $PID` (and `-d` / `--data` JSON). Put/get via `aerekos call` or curl.

## Quick start

```bash
cd worker/transfer_manager
npm install   # use Node 20 (.nvmrc)
npm start
# curl http://localhost:3148/health
```

## Testing

| Layer | Command | Notes |
|-------|---------|-------|
| Unit | `npm run test:unit` | prod skip-fake guard + bootstrap wiring |
| Integration | `npm run test:integration` | health/ready/info, CRUD, put/get without conductor → 503 |
| All | `npm test` | unit + integration |
| Live e2e | parked | See [`tests/e2e/README.md`](./tests/e2e/README.md) — needs conductor + storage_manager |
