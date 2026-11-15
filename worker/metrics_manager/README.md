# Metrics Manager

**AWS analog:** CloudWatch Metrics · **Port:** `3105`

Project-scoped **metric series** samples (`name` / `value` / `labels`) plus **alarm** rules that can fire into `event_manager` on evaluate. Pair with `GET /metrics` on the same process (Prometheus text). Aggregation cluster / Prometheus federation is **out of scope** for the MVP.

No production mocks — `assertNoSkipFakes()` refuses shared skip-fake flags when `NODE_ENV=production`. Alarm publish to `event_manager` respects `SKIP_OUTBOUND` (test/dev only).

## Status

**MVP / implemented** — `MetricSeries` + `MetricAlarm` SQLite, series CRUD/sample/scrape, alarm CRUD/evaluate, `/health`, `/ready`, `/api/v1/info`, `/metrics`.

**Tutorial / ServiceGuide:** none (generic proxy / CLI).

## Access

- Direct: `http://localhost:3105/...`
- Conductor proxy: `{CONDUCTOR}/api/services/metrics_manager{path}` (JWT or service token)

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`) |
| `POST` | `/api/v1/series` | Create a series sample |
| `POST` | `/api/v1/series/sample` | Upsert sample by name |
| `POST` | `/api/v1/series/scrape` | Record scrape sample |
| `GET` | `/api/v1/series` | List (`metric_name`, `task_id`, `limit`) |
| `GET` | `/api/v1/series/:id` | Get one |
| `PATCH`/`PUT` | `/api/v1/series/:id` | Update |
| `DELETE` | `/api/v1/series/:id` | Delete |
| `POST` | `/api/v1/alarms` | Create alarm rule |
| `GET` | `/api/v1/alarms` | List alarms |
| `GET` | `/api/v1/alarms/:id` | Get one |
| `PATCH`/`PUT` | `/api/v1/alarms/:id` | Update |
| `DELETE` | `/api/v1/alarms/:id` | Delete |
| `POST` | `/api/v1/alarms/evaluate` | Evaluate vs value; publish unless `SKIP_OUTBOUND` |

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/metrics_manager.yaml`](../../docs/openapi/metrics_manager.yaml). Catalog mirror: [`docs/services/metrics_manager.md`](../../docs/services/metrics_manager.md).

## SDK / CLI

- **SDK (Node):** `client.resource('metrics_manager', 'series')` or generic `client.proxy('metrics_manager', …)`.
- **CLI:** `aerekos call metrics_manager POST "/api/v1/series" --project $PID --data '{"name":"demo","value":"1"}'`

## Quick start

```bash
cd worker/metrics_manager
cp .env_example .env
npm install
npm start
# curl http://localhost:3105/health
```

## Environment

See [`.env_example`](./.env_example). `DATABASE_PATH` for SQLite. Set `CONDUCTOR_URL` (+ token) for auto-registration and alarm publish. `SKIP_OUTBOUND=1` parks evaluate publish.

## Docker

Build context is the parent `worker/` directory:

```bash
docker build -f metrics_manager/Dockerfile -t aerekos-metrics_manager worker/
```

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | MetricSeriesService + prod-guard |
| Integration | `npm run test:integration` | health/ready/info/metrics + series/alarms |
| All | `npm test` | unit + integration |
| E2E | [`tests/e2e/README.md`](./tests/e2e/README.md) | live proxy parked; port in root `e2e/catalog.js` |

## Related

- Conductor registration / proxy · `event_manager` (alarm publish)
- Root [`GOLDEN_PATH.md`](../../GOLDEN_PATH.md)
