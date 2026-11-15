# Trace Manager

**AWS analog:** X-Ray · **Port:** `3143`

Project-scoped **trace** metadata (`/api/v1/traces` CRUD) plus **OTLP/HTTP ingest** at `POST /v1/traces` and span list/query (`GET /api/v1/spans`, `GET /api/v1/query`) stored in a SQLite sidecar (`*.db.spans`). Pair with `/health` / `/ready` / `/metrics` on the same process. Not a full X-Ray / Jaeger / Tempo cluster — local SQLite only.

No production mocks — `assertNoSkipFakes()` + `createManagerApp` refuse shared skip-fake flags when `NODE_ENV=production`.

## Status

**MVP / implemented** — traces CRUD, ensure-defaults, OTLP ingest, span list/query, `/health`, `/ready`, `/api/v1/info`, `/metrics`.

**Parked:** live conductor proxy e2e (needs stack + enabled `trace_manager` on a non-prod project).

**Tutorial / ServiceGuide:** none (generic ManagerConsole / proxy / CLI).

## Access

- Direct: `http://localhost:3143/...`
- Conductor proxy: `{CONDUCTOR}/api/services/trace_manager{path}` (JWT or service token)

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`) |
| `POST` | `/api/v1/ensure-defaults` | Seed sample trace if empty |
| `POST` | `/v1/traces` | OTLP/HTTP ingest (`resourceSpans`) |
| `GET` | `/api/v1/spans` | List stored spans (`project_id`, optional `trace_id` / `name` / `limit`) |
| `GET` | `/api/v1/query` | Query spans (same filters; `q` aliases `trace_id`) |
| `POST` | `/api/v1/traces` | Create trace metadata |
| `GET` | `/api/v1/traces` | List traces |
| `GET` | `/api/v1/traces/:id` | Get one |
| `PATCH`/`PUT` | `/api/v1/traces/:id` | Update |
| `DELETE` | `/api/v1/traces/:id` | Delete |

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/trace_manager.yaml`](../../docs/openapi/trace_manager.yaml). Catalog mirror: [`docs/services/trace_manager.md`](../../docs/services/trace_manager.md).

## SDK / CLI

- **SDK (Node):** `client.resource('trace_manager', 'traces')` or generic `client.proxy('trace_manager', …)`.
- **CLI:** `aerekos call trace_manager POST "/api/v1/traces" --project $PID --data '{"name":"demo"}'`

## Quick start

```bash
cd worker/trace_manager
cp .env_example .env
npm install
npm start
# curl http://localhost:3143/health
```

## Environment

See [`.env_example`](./.env_example). `DATABASE_PATH` for SQLite (span sidecar is `${DATABASE_PATH}.spans`). Set `CONDUCTOR_URL` (+ token) for auto-registration.

## Docker

Build context is the parent `worker/` directory:

```bash
docker build -f trace_manager/Dockerfile -t aerekos-trace_manager worker/
```

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | prod-guard + bootstrap wiring |
| Integration | `npm run test:integration` | health/ready/info/metrics + CRUD + OTLP ingest/spans |
| All | `npm test` | unit + integration |
| E2E | [`tests/e2e/README.md`](./tests/e2e/README.md) | live proxy parked; port in root `e2e/catalog.js` |

## Related

- Conductor registration / proxy · root [`GOLDEN_PATH.md`](../../GOLDEN_PATH.md)
