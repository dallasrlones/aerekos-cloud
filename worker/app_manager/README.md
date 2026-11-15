# app_manager

**AWS analog:** Amplify / App Runner · **Port:** `3125`

Project-scoped **app** records (`name`, optional `repo_url` / `build_command` / `metadata`) plus `POST /api/v1/apps/scaffold` which returns FE starter file contents for **Icarus IDE**. Actual deploy is via compute_manager / cicd_manager / tunnel_manager — this service does not build or ship images.

## Status / honesty

| Claim | Reality |
|-------|---------|
| CRUD | Real SQLite apps via `/api/v1/apps` (`aerekos-record`) |
| Scaffold | Returns in-memory file map + creates an app row with `metadata` JSON (`scaffold: true`). Does **not** write to git_manager or the IDE by itself. |
| Deploy / Amplify | Naming analog only — no AWS Amplify/App Runner client |
| Prod mocks | No fake apps in prod. Tests use temp SQLite + `SKIP_SERVICE_REGISTRATION=true`. |
| Tutorial | **None** — no dedicated ServiceGuide (`CONSOLE_GUIDES`); generic ManagerConsole / Applications entry only |

## Access

- Direct: `http://localhost:3125/...`
- Conductor proxy: `{CONDUCTOR}/api/services/app_manager{path}` (JWT or service token)

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`, aws `Amplify / App Runner`) |
| `POST` | `/api/v1/apps` | Create (`project_id`, `name`, …) |
| `GET` | `/api/v1/apps` | List (`?project_id=`) |
| `GET` | `/api/v1/apps/:id` | Get one |
| `PATCH`/`PUT` | `/api/v1/apps/:id` | Update |
| `DELETE` | `/api/v1/apps/:id` | Delete |
| `POST` | `/api/v1/apps/scaffold` | FE starter files + app row |

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/app_manager.yaml`](../../docs/openapi/app_manager.yaml). Catalog: [`docs/services/app_manager.md`](../../docs/services/app_manager.md).

## SDK / CLI

- **SDK (Node):** generic CRUD `client.resource('app_manager', 'apps')`. No dedicated `client.app` helper.
- **CLI:** generic `aerekos call` / resource verbs — no dedicated `aerekos app` subcommand.

```bash
aerekos call app_manager POST "/api/v1/apps" --project $PID --data '{"name":"demo"}'
aerekos call app_manager GET "/api/v1/apps?project_id=$PID"
aerekos call app_manager POST "/api/v1/apps/scaffold" --project $PID --data '{"name":"fe"}'
```

## Quick start

```bash
cd worker/app_manager
cp .env_example .env   # optional
npm install            # Node 20+
npm start
# curl http://localhost:3125/health
```

## Environment

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | `3125` | Listen port |
| `DATABASE_PATH` | `data/app_manager.db` | SQLite file |
| `SKIP_SERVICE_REGISTRATION` | unset | `true` in tests |
| `CONDUCTOR_URL` | unset | Optional auto-registration |

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | AppProjectService CRUD + scaffold |
| Integration | `npm run test:integration` | health/ready/info/metrics + CRUD + scaffold |
| All | `npm test` | unit + integration |
| Live e2e | needs conductor | Proxy path parked without stack; root `e2e/catalog.js` lists CRUD |

## Related

- Conductor seed / `managerServicePorts` → `3125`
- Root [`GOLDEN_PATH.md`](../../GOLDEN_PATH.md)
