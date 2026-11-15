# Logs Manager

**AWS analog:** CloudWatch Logs · **Port:** `3104`

Project-scoped **append-only** log ingest and query. Structured **`context`** JSON is optional. Batch ingest (`POST /api/v1/logs/batch`) serves the worker outbox/shipper. Pair with `GET /metrics` on the same process.

No production mocks — `assertNoSkipFakes()` refuses shared skip-fake flags when `NODE_ENV=production`.

## Status

**MVP / implemented** — `LogEvent` SQLite, ingest/query/batch/compact/delete, `/health`, `/ready`, `/api/v1/info`, `/metrics`.

**Tutorial / ServiceGuide:** ManagerConsole `CONSOLE_GUIDES.logs_manager` (search + batch ingest examples).

## Access

- Direct: `http://localhost:3104/...`
- Conductor proxy: `{CONDUCTOR}/api/services/logs_manager{path}` (JWT or service token)

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`) |
| `POST` | `/api/v1/logs` | Ingest: `level`, `message`, optional `source` / `context` |
| `POST` | `/api/v1/logs/batch` | Batch ingest (`entries[]`, max 200) |
| `GET` | `/api/v1/logs` | Query (`project_id`, `level`, `source`, `q`, `since`, `until`, `limit`) |
| `GET` | `/api/v1/logs/:id` | Get one |
| `DELETE` | `/api/v1/logs/:id` | Delete one |
| `POST` | `/api/v1/logs/compact` | Drop rows older than retention days |

Levels: `debug` \| `info` \| `warn` \| `error` \| `fatal`. Message max 32KiB; context JSON max 64KiB.

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/logs_manager.yaml`](../../docs/openapi/logs_manager.yaml). Catalog mirror: [`docs/services/logs_manager.md`](../../docs/services/logs_manager.md).

## SDK / CLI

- **SDK (Node):** generic `client.proxy('logs_manager', …)` (no dedicated `client.logs` surface).
- **CLI:** `aerekos call logs_manager POST "/api/v1/logs" --project $PID --data '{"level":"info","message":"hi"}'`

## Quick start

```bash
cd worker/logs_manager
cp .env_example .env
npm install
npm start
# curl http://localhost:3104/health
```

## Environment

See [`.env_example`](./.env_example). `DATABASE_PATH` for SQLite. Set `CONDUCTOR_URL` for auto-registration. `LOG_RETENTION_DAYS` defaults compact retention (14).

## Docker

Build context is the parent `worker/` directory:

```bash
docker build -f logs_manager/Dockerfile -t aerekos-logs_manager worker/
```

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | LogEventService + prod-guard |
| Integration | `npm run test:integration` | health/ready/info/metrics + API |
| All | `npm test` | unit + integration |
| E2E | [`tests/e2e/README.md`](./tests/e2e/README.md) | live proxy parked; port in root `e2e/catalog.js` |

## Related

- Conductor registration / proxy · worker `logOutbox` shipper
- Root [`GOLDEN_PATH.md`](../../GOLDEN_PATH.md)
