# system_manager

**AWS analog:** Systems Manager · **Port:** `3127`

Project-scoped **maintenance task** specs (CRUD `/api/v1/tasks`) in SQLite via `aerekos-record`, plus **host OS/Docker check+update** routes that **proxy** to conductor `/api/workers/:id/host/*` (real probe/patch runs on the worker via `hostPatch`). Not AWS SSM. `SKIP_HOST_PATCH` is a shared skip-fake (worker/tests) — refused in production via `assertNoSkipFakes` + `createManagerApp`.

## Status / honesty

| Claim | Reality |
|-------|---------|
| Tasks CRUD | Real SQLite via `/api/v1/tasks` |
| `POST …/tasks/:id/run` | Needs `spec_json.image` → compute_manager, or `spec_json.url` HTTP; else 400 |
| Host check/update | Proxies to conductor; forwards status/body (503 when worker offline / proxy fails) |
| SSM / fleet patch parity | Naming analog only — no AWS SSM client |
| Prod mocks | No skip-fakes (incl. `SKIP_HOST_PATCH`) when `NODE_ENV=production` |
| Tutorial | **None** standalone — console generic **ManagerConsole** (no `CONSOLE_GUIDES` entry) |

## Access

- Direct: `http://localhost:3127/...`
- Conductor proxy: `{CONDUCTOR}/api/services/system_manager{path}` (JWT or service token)

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`) |
| `POST` | `/api/v1/tasks` | Create (`project_id`, `name`, optional `spec_json` / `state`) |
| `GET` | `/api/v1/tasks` | List (`?project_id=`) |
| `GET` | `/api/v1/tasks/:id` | Get one |
| `PATCH`/`PUT` | `/api/v1/tasks/:id` | Update |
| `POST` | `/api/v1/tasks/:id/run` | Run from `spec_json` (image or url) |
| `DELETE` | `/api/v1/tasks/:id` | Delete |
| `GET`/`POST` | `/api/v1/hosts/:workerId/check` | Proxy host OS/Docker probe |
| `POST` | `/api/v1/hosts/:workerId/update` | Proxy host update (`{ target }`) |

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/system_manager.yaml`](../../docs/openapi/system_manager.yaml). Catalog: [`docs/services/system_manager.md`](../../docs/services/system_manager.md).

## SDK / CLI

- **SDK (Node):** `client.resource('system_manager', 'tasks')` (create/list/get/update/delete). Host check/update via SDK/`aerekos call` / curl.
- **CLI:** `aerekos system_manager tasks list|get|create|update|delete --project $PID` (and `-d` JSON), or generic `aerekos call`.

## Quick start

```bash
cd worker/system_manager
cp .env_example .env   # optional
npm install            # Node 20+
npm start
# curl http://localhost:3127/health
```

## Environment

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | `3127` | Listen port |
| `DATABASE_PATH` | `data/system_manager.db` | Catalog SQLite file |
| `SKIP_SERVICE_REGISTRATION` | unset | `true` in tests |
| `CONDUCTOR_URL` | unset | Optional auto-registration; host routes need reachable conductor |
| `CONDUCTOR_TOKEN` / `SERVICE_TOKEN` | unset | Auth for registration / task run |
| `SKIP_HOST_PATCH` | unset | Shared skip-fake — forbidden when `NODE_ENV=production` |

## Testing

| Layer | Command | Notes |
|-------|---------|-------|
| Unit | `npm run test:unit` | prod guard + `assertNoSkipFakes` / `createManagerApp` wiring |
| Integration | `npm run test:integration` | health/ready/info/metrics + CRUD + mocked host proxy |
| All | `npm test` | unit + integration |
| Live e2e | needs conductor | Proxy + live host check/update parked; root `e2e/catalog.js` lists CRUD |

## Related

- Conductor seed / `managerServicePorts` → `3127`
- Worker `hostPatch` for real OS/Docker probe (respects `SKIP_HOST_PATCH` in tests)
- Root [`GOLDEN_PATH.md`](../../GOLDEN_PATH.md)
