# crawler_manager

**AWS analog:** Glue Crawler · **Port:** `3121`

Project-scoped **crawl job** records (`start_url`, `max_depth`, `state`, `result_summary`) with optional single-URL fetch via `POST /api/v1/jobs/:id/run` and a canary probe. SQLite via `aerekos-record`. Not a full site crawler — one GET per run, title/bytes summary only. `SKIP_CRAWL` is test/dev only (refused in production via `assertNoSkipFakes`).

## Status / honesty

| Claim | Reality |
|-------|---------|
| CRUD | Real SQLite jobs via `/api/v1/jobs` |
| Run fetch | `POST .../jobs/:id/run` GETs `start_url` once (timeout/size capped) |
| Canary | `POST /api/v1/jobs/canary` one-shot URL probe |
| Multi-page crawl / Glue parity | Naming analog only — no AWS Glue client, no link graph |
| Prod mocks | No `SKIP_CRAWL` / skip-fakes when `NODE_ENV=production` |
| Tutorial | **None** standalone — console generic **ManagerConsole** (no `CONSOLE_GUIDES` entry) |

## Access

- Direct: `http://localhost:3121/...`
- Conductor proxy: `{CONDUCTOR}/api/services/crawler_manager{path}` (JWT or service token)

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`) |
| `POST` | `/api/v1/jobs/canary` | One-shot URL canary (`{ url }`) |
| `POST` | `/api/v1/jobs` | Create (`project_id`, `name`, …) |
| `GET` | `/api/v1/jobs` | List (`?project_id=`) |
| `GET` | `/api/v1/jobs/:id` | Get one |
| `PATCH`/`PUT` | `/api/v1/jobs/:id` | Update |
| `POST` | `/api/v1/jobs/:id/run` | Fetch `start_url` / update `result_summary` |
| `DELETE` | `/api/v1/jobs/:id` | Delete |

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/crawler_manager.yaml`](../../docs/openapi/crawler_manager.yaml). Catalog: [`docs/services/crawler_manager.md`](../../docs/services/crawler_manager.md).

## SDK / CLI

- **SDK (Node):** `client.resource('crawler_manager', 'jobs')` (create/list/get/update/delete). Run/canary via SDK/`aerekos call` / curl.
- **CLI:** `aerekos crawler_manager jobs list|get|create|update|delete --project $PID` (and `-d` JSON for create/update), or generic `aerekos call`.

## Quick start

```bash
cd worker/crawler_manager
cp .env_example .env   # optional
npm install            # Node 20+
npm start
# curl http://localhost:3121/health
```

## Environment

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | `3121` | Listen port |
| `DATABASE_PATH` | `data/crawler_manager.db` | SQLite file |
| `SKIP_SERVICE_REGISTRATION` | unset | `true` in tests |
| `SKIP_CRAWL` | unset | Skip live HTTP in tests/dev only |
| `CONDUCTOR_URL` | unset | Optional auto-registration |

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | prod guard + `assertNoSkipFakes` wiring |
| Integration | `npm run test:integration` | health/ready/info + CRUD + run (SKIP_CRAWL) |
| All | `npm test` | unit + integration |
| Live e2e | needs conductor | Proxy path parked; root `e2e/catalog.js` lists CRUD |

## Related

- Conductor seed / `managerServicePorts` → `3121`
- Network egress required for live `run` / canary (catalog status `needs-keys`)
- Root [`GOLDEN_PATH.md`](../../GOLDEN_PATH.md)
