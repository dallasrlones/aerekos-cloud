# analytics_manager

**AWS analog:** Pinpoint / Kinesis Analytics · **Port:** `3117`

Project-scoped **analytics events** (`name`, optional `event` / `value` / `properties`) plus `POST /api/v1/query-on-storage` which loads matching rows into an in-memory SQLite table and runs a read SQL query. Pinpoint / Kinesis Analytics is a naming analog only — no AWS client.

## Status / honesty

| Claim | Reality |
|-------|---------|
| CRUD | Real SQLite events via `/api/v1/events` (`aerekos-record`) |
| Query-on-storage | In-process better-sqlite3 over loaded events (not DuckDB; not object-store scan) |
| Pinpoint / Kinesis | Naming analog only |
| Prod mocks | No fake events in prod. `assertNoSkipFakes({ extra: ['SKIP_DUCKDB'] })` on boot. Tests use temp SQLite + `SKIP_SERVICE_REGISTRATION=true`. |
| Tutorial | **None** — no dedicated ServiceGuide (`CONSOLE_GUIDES`); generic ManagerConsole / Observability entry only |

## Access

- Direct: `http://localhost:3117/...`
- Conductor proxy: `{CONDUCTOR}/api/services/analytics_manager{path}` (JWT or service token)

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`, aws `Pinpoint / Kinesis Analytics`) |
| `POST` | `/api/v1/events` | Create (`project_id`, `name`, …) |
| `GET` | `/api/v1/events` | List (`?project_id=`) |
| `GET` | `/api/v1/events/:id` | Get one |
| `PATCH`/`PUT` | `/api/v1/events/:id` | Update |
| `DELETE` | `/api/v1/events/:id` | Delete |
| `POST` | `/api/v1/query-on-storage` | Run SELECT over loaded events (SQLite engine) |

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/analytics_manager.yaml`](../../docs/openapi/analytics_manager.yaml). Catalog: [`docs/services/analytics_manager.md`](../../docs/services/analytics_manager.md).

## SDK / CLI

- **SDK (Node):** generic CRUD `client.resource('analytics_manager', 'events')`. No dedicated `client.analytics` helper.
- **CLI:** generic `aerekos call` / resource verbs — no dedicated `aerekos analytics` subcommand.

```bash
aerekos call analytics_manager POST "/api/v1/events" --project $PID --data '{"name":"demo","event":"ui.click"}'
aerekos call analytics_manager GET "/api/v1/events?project_id=$PID"
aerekos call analytics_manager POST "/api/v1/query-on-storage" --project $PID --data '{"sql":"SELECT * FROM events LIMIT 10"}'
```

## Quick start

```bash
cd worker/analytics_manager
cp .env_example .env   # optional
npm install            # Node 20+
npm start
# curl http://localhost:3117/health
```

## Environment

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | `3117` | Listen port |
| `DATABASE_PATH` | `data/analytics_manager.db` | SQLite file |
| `SKIP_SERVICE_REGISTRATION` | unset | `true` in tests |
| `SKIP_DUCKDB` | unset | Test-only stub for query-on-storage; refused in production |
| `CONDUCTOR_URL` | unset | Optional auto-registration |

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | AnalyticsEventService + prod guards |
| Integration | `npm run test:integration` | health/ready/info/metrics + CRUD + query-on-storage |
| All | `npm test` | unit + integration |
| Live e2e | needs conductor | Proxy path parked without stack; root `e2e/catalog.js` lists CRUD |

## Related

- Conductor seed / `managerServicePorts` → `3117`
