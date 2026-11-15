# query_manager

**AWS analog:** Athena · **Port:** `3145`

Project-scoped **query definitions** (CRUD `/api/v1/queries`) plus `POST /api/v1/sql` that runs SQL against a **per-project better-sqlite3** file under `QUERY_DATA_DIR`. `POST /api/v1/ensure-defaults` seeds a `sample` query when empty. SQLite catalog via `aerekos-record`. Athena / DuckDB lake query is a **naming analog only** — no AWS Athena client. `SKIP_DUCKDB` short-circuits `/sql` in tests/dev only (refused in production via `assertNoSkipFakes` + `createManagerApp`).

## Status / honesty

| Claim | Reality |
|-------|---------|
| Queries CRUD | Real SQLite via `/api/v1/queries` |
| `POST /sql` | better-sqlite3 per-project file; ATTACH/VACUUM rejected |
| Athena parity | Naming analog only — no AWS Athena / S3 catalog |
| DuckDB | Flag name historical; engine is sqlite; `SKIP_DUCKDB` is a fake short-circuit |
| Prod mocks | No `SKIP_DUCKDB` / skip-fakes when `NODE_ENV=production` |
| Tutorial | **None** standalone — console generic **ManagerConsole** (no `CONSOLE_GUIDES` entry) |

## Access

- Direct: `http://localhost:3145/...`
- Conductor proxy: `{CONDUCTOR}/api/services/query_manager{path}` (JWT or service token)

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`) |
| `POST` | `/api/v1/ensure-defaults` | Seed sample query if missing |
| `POST` | `/api/v1/sql` | Run SQL (`project_id`, `sql`) → `{ rows, engine }` |
| `POST` | `/api/v1/queries` | Create (`project_id`, `name`, optional `sql` / `bucket`) |
| `GET` | `/api/v1/queries` | List (`?project_id=`) |
| `GET` | `/api/v1/queries/:id` | Get one |
| `PATCH`/`PUT` | `/api/v1/queries/:id` | Update |
| `DELETE` | `/api/v1/queries/:id` | Delete |

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/query_manager.yaml`](../../docs/openapi/query_manager.yaml). Catalog: [`docs/services/query_manager.md`](../../docs/services/query_manager.md).

## SDK / CLI

- **SDK (Node):** `client.resource('query_manager', 'queries')` (create/list/get/update/delete). SQL via SDK/`aerekos call` / curl.
- **CLI:** `aerekos query_manager queries list|get|create|update|delete --project $PID` (and `-d` JSON), or generic `aerekos call`.

## Quick start

```bash
cd worker/query_manager
cp .env_example .env   # optional
npm install            # Node 20+
npm start
# curl http://localhost:3145/health
```

## Environment

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | `3145` | Listen port |
| `DATABASE_PATH` | `data/query_manager.db` | Catalog SQLite file |
| `QUERY_DATA_DIR` | `data/` | Per-project `query-<pid>.sqlite` for `/sql` |
| `SKIP_SERVICE_REGISTRATION` | unset | `true` in tests |
| `SKIP_DUCKDB` | unset | Short-circuit `/sql` in tests/dev only |
| `CONDUCTOR_URL` | unset | Optional auto-registration |
| `CONDUCTOR_TOKEN` / `SERVICE_TOKEN` | unset | Auth for registration |

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | prod guard + `assertNoSkipFakes` / `SKIP_DUCKDB` wiring |
| Integration | `npm run test:integration` | health/ready/info/metrics + CRUD + `/sql` |
| All | `npm test` | unit + integration |
| Live e2e | needs conductor | Proxy path parked; root `e2e/catalog.js` lists CRUD |

## Related

- Conductor seed / `managerServicePorts` → `3145`
- Root [`GOLDEN_PATH.md`](../../GOLDEN_PATH.md)
