# worker_manager

**AWS analog:** SSM fleet / tags · **Port:** `3128`

Project-scoped **worker annotations** (`name`, `worker_id`, `key`, `value`) in SQLite via `aerekos-record`, plus optional `POST /api/v1/sync` that upserts from conductor `/api/workers`. Not live AWS SSM — fleet labels/metadata only. The worker **agent** package owns node lifecycle; this manager is labels only. Shared skip-fake flags are refused in production via `assertNoSkipFakes`.

## Status / honesty

| Claim | Reality |
|-------|---------|
| CRUD | Real SQLite annotations via `/api/v1/annotations` |
| Sync | `POST /api/v1/sync` needs `CONDUCTOR_URL` + `/api/workers` |
| SSM / fleet parity | Naming analog only — no AWS client |
| Worker agent lifecycle | Out of scope — see `worker/` agent package |
| Prod mocks | No skip-fakes when `NODE_ENV=production` |
| Tutorial | **None** standalone — console generic **ManagerConsole** (no `CONSOLE_GUIDES` entry) |

## Access

- Direct: `http://localhost:3128/...`
- Conductor proxy: `{CONDUCTOR}/api/services/worker_manager{path}` (JWT or service token)

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`) |
| `POST` | `/api/v1/sync` | Upsert from conductor workers |
| `POST` | `/api/v1/annotations` | Create (`project_id`, `name`, …) |
| `GET` | `/api/v1/annotations` | List (`?project_id=`) |
| `GET` | `/api/v1/annotations/:id` | Get one |
| `PATCH`/`PUT` | `/api/v1/annotations/:id` | Update |
| `DELETE` | `/api/v1/annotations/:id` | Delete |

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/worker_manager.yaml`](../../docs/openapi/worker_manager.yaml). Catalog: [`docs/services/worker_manager.md`](../../docs/services/worker_manager.md).

## SDK / CLI

- **SDK (Node):** `client.resource('worker_manager', 'annotations')` (create/list/get/update/delete). Sync via SDK/`aerekos call` / curl.
- **CLI:** `aerekos worker_manager annotations list|get|create|update|delete --project $PID` (and `-d` JSON for create/update), or generic `aerekos call`.

## Quick start

```bash
cd worker/worker_manager
cp .env_example .env   # optional
npm install            # Node 20+
npm start
# curl http://localhost:3128/health
```

## Environment

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | `3128` | Listen port |
| `DATABASE_PATH` | `data/worker_manager.db` | SQLite file |
| `SKIP_SERVICE_REGISTRATION` | unset | `true` in tests |
| `CONDUCTOR_URL` | unset | Optional auto-registration + required for sync |

## Testing

| Layer | Command | Notes |
|-------|---------|-------|
| Unit | `npm run test:unit` | prod guard + `assertNoSkipFakes` wiring |
| Integration | `npm run test:integration` | health/ready/info + CRUD + sync-without-conductor |
| All | `npm test` | unit + integration |
| Live e2e | parked | See [`tests/e2e/README.md`](./tests/e2e/README.md) — needs conductor |

## Related

- Conductor seed / `managerServicePorts` → `3128`
- Sync needs conductor `/api/workers`
- Root [`GOLDEN_PATH.md`](../../GOLDEN_PATH.md)
