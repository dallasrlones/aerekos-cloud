# search_manager

**AWS analog:** OpenSearch · **Port:** `3144`

Project-scoped **search indexes** (CRUD `/api/v1/indexes`) plus `POST /api/v1/ensure-defaults` (seeds `docs` when empty), `POST /api/v1/index` (FTS5 document ingest), and `POST /api/v1/query` (real hits; `{ empty: true }` only when the index has no docs). SQLite via `aerekos-record` for index metadata; FTS5 sidecar (`*.db.fts`) for document bodies. No production mocks — `assertNoSkipFakes()` + `createManagerApp` refuse skip-fake flags when `NODE_ENV=production`.

## Status

**MVP / implemented** — indexes CRUD, ensure-defaults, index/query FTS, `/health`, `/ready`, `/api/v1/info`, `/metrics`.

**Parked:** live conductor proxy e2e (needs stack + enabled `search_manager` on a non-prod project). Not a full OpenSearch cluster — local SQLite FTS5 only.

**Tutorial:** none standalone. Console uses generic **ManagerConsole** for `search_manager` (no dedicated SearchManager ServiceGuide).

## Access

- Direct: `http://localhost:3144/...`
- Conductor proxy: `{CONDUCTOR}/api/services/search_manager{path}` (JWT or service token)

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`) |
| `POST` | `/api/v1/ensure-defaults` | Seed default `docs` index if missing |
| `POST` | `/api/v1/index` | Index documents into FTS5 |
| `POST` | `/api/v1/query` | FTS query → `{ hits }` (or `{ empty: true }`) |
| `POST` | `/api/v1/indexes` | Create (`project_id`, `name`, optional `engine` / `prefix`) |
| `GET` | `/api/v1/indexes` | List (`?project_id=`) |
| `GET` | `/api/v1/indexes/:id` | Get one |
| `PATCH`/`PUT` | `/api/v1/indexes/:id` | Update |
| `DELETE` | `/api/v1/indexes/:id` | Delete |

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/search_manager.yaml`](../../docs/openapi/search_manager.yaml). Catalog mirror: [`docs/services/search_manager.md`](../../docs/services/search_manager.md).

## SDK / CLI

- **SDK (Node):** generic `client.resource('search_manager', 'indexes')` / `client.proxy`; query via proxy `POST /api/v1/query`.
- **CLI:** `aerekos search_manager indexes list|get|create|update|delete --project $PID` (and `-d` / `--data` JSON). Index/query via `aerekos call` or curl.

## Quick start

```bash
cd worker/search_manager
npm install   # use Node 20 (.nvmrc)
npm start
# curl http://localhost:3144/health
```

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | prod skip-fake guard + bootstrap wiring |
| Integration | `npm run test:integration` | health/ready/info, CRUD, FTS index/query |
| All | `npm test` | unit + integration |
| Live e2e | parked | See [`tests/e2e/README.md`](./tests/e2e/README.md) — needs conductor |
