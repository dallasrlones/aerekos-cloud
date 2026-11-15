# host_manager

**AWS analog:** EC2 / SSM inventory · **Port:** `3122`

Project-scoped **host** records (`name`, `hostname`, `address`, `role`, `metadata`) in SQLite via `aerekos-record`, plus optional `POST /api/v1/sync` that upserts from conductor `/api/workers`. Not live EC2/SSM — metadata inventory only; no host probing / patch orchestration here (`system_manager` owns OS/Docker check-update). Skip-fakes (including `SKIP_HOST_PATCH`) are refused in production via `assertNoSkipFakes`.

## Status / honesty

| Claim | Reality |
|-------|---------|
| CRUD | Real SQLite hosts via `/api/v1/hosts` |
| Sync | `POST /api/v1/sync` needs `CONDUCTOR_URL` + `/api/workers` |
| EC2 / SSM parity | Naming analog only — no AWS client |
| Live host probe / patch | Out of scope — see `system_manager` |
| Prod mocks | No skip-fakes when `NODE_ENV=production` |
| Tutorial | **None** standalone — console generic **ManagerConsole** (no `CONSOLE_GUIDES` entry) |

## Access

- Direct: `http://localhost:3122/...`
- Conductor proxy: `{CONDUCTOR}/api/services/host_manager{path}` (JWT or service token)

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`) |
| `POST` | `/api/v1/sync` | Upsert from conductor workers |
| `POST` | `/api/v1/hosts` | Create (`project_id`, `name`, …) |
| `GET` | `/api/v1/hosts` | List (`?project_id=`) |
| `GET` | `/api/v1/hosts/:id` | Get one |
| `PATCH`/`PUT` | `/api/v1/hosts/:id` | Update |
| `DELETE` | `/api/v1/hosts/:id` | Delete |

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/host_manager.yaml`](../../docs/openapi/host_manager.yaml). Catalog: [`docs/services/host_manager.md`](../../docs/services/host_manager.md).

## SDK / CLI

- **SDK (Node):** `client.resource('host_manager', 'hosts')` (create/list/get/update/delete). Sync via SDK/`aerekos call` / curl.
- **CLI:** `aerekos host_manager hosts list|get|create|update|delete --project $PID` (and `-d` JSON for create/update), or generic `aerekos call`.

## Quick start

```bash
cd worker/host_manager
cp .env_example .env   # optional
npm install            # Node 20+
npm start
# curl http://localhost:3122/health
```

## Environment

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | `3122` | Listen port |
| `DATABASE_PATH` | `data/host_manager.db` | SQLite file |
| `SKIP_SERVICE_REGISTRATION` | unset | `true` in tests |
| `CONDUCTOR_URL` | unset | Optional auto-registration + required for sync |
| `SKIP_HOST_PATCH` | unset | Shared skip-fake — forbidden when `NODE_ENV=production` |

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | prod guard + `assertNoSkipFakes` wiring |
| Integration | `npm run test:integration` | health/ready/info + CRUD + sync-without-conductor |
| All | `npm test` | unit + integration |
| Live e2e | needs conductor | Proxy + live sync parked; root `e2e/catalog.js` lists CRUD |

## Related

- Conductor seed / `managerServicePorts` → `3122`
- Sync needs conductor `/api/workers`
- Root [`GOLDEN_PATH.md`](../../GOLDEN_PATH.md)
