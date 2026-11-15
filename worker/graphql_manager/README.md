# graphql_manager

**AWS analog:** AppSync · **Port:** `3141`

Project-scoped **GraphQL API** records (`/api/v1/apis`) compiled from Data API model defs. `POST /api/v1/compile` builds an SDL schema (types + list/create/update fields from relationships). `POST /api/v1/execute` walks a **subset** of GraphQL (single selection set; list/get + create/update mutations) against `api_manager` Data API via conductor proxy — not a full AppSync runtime / subscriptions / auth directives. `POST /api/v1/ensure-defaults` seeds an `app` schema (User/Post) and best-effort applies models to `api_manager`. SQLite via `aerekos-record`. No production mocks — `createManagerApp` → `assertNoSkipFakes()` refuses skip-fake flags when `NODE_ENV=production`.

## Status / honesty

| Claim | Reality |
|-------|---------|
| CRUD | Real SQLite apis via `/api/v1/apis` |
| Compile | Local SDL from `{ Model: { fields, settings } }` — not AWS AppSync schema import |
| Execute | Subset parser → Data API HTTP; needs conductor + `api_manager` for live data |
| Subscriptions / VTL / Cognito | Naming analog only |
| Prod mocks | No skip-fake / `MOCK_*` when `NODE_ENV=production` |
| Tutorial | **None** standalone — console generic **ManagerConsole** (no `CONSOLE_GUIDES` entry) |

## Access

- Direct: `http://localhost:3141/...`
- Conductor proxy: `{CONDUCTOR}/api/services/graphql_manager{path}` (JWT or service token)

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`) |
| `POST` | `/api/v1/ensure-defaults` | Seed default `app` schema (+ apply Data API models) |
| `POST` | `/api/v1/compile` | Compile schema from Data API models |
| `POST` | `/api/v1/execute` | Execute query/mutation against Data API |
| `POST` | `/api/v1/apis` | Create (`project_id`, `name`, …) |
| `GET` | `/api/v1/apis` | List (`?project_id=`) |
| `GET` | `/api/v1/apis/:id` | Get one |
| `PATCH`/`PUT` | `/api/v1/apis/:id` | Update |
| `DELETE` | `/api/v1/apis/:id` | Delete |

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/graphql_manager.yaml`](../../docs/openapi/graphql_manager.yaml). Catalog: [`docs/services/graphql_manager.md`](../../docs/services/graphql_manager.md).

## SDK / CLI

- **SDK (Node):** `client.resource('graphql_manager', 'apis')` (create/list/get/update/delete). Compile/execute via SDK/`aerekos call` / curl.
- **CLI:** `aerekos graphql_manager apis list|get|create|update|delete --project $PID` (and `-d` JSON), or generic `aerekos call`.

## Quick start

```bash
cd worker/graphql_manager
cp .env_example .env   # optional
npm install            # Node 20+
npm start
# curl http://localhost:3141/health
```

## Environment

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | `3141` | Listen port |
| `DATABASE_PATH` | `data/graphql_manager.db` | SQLite file |
| `SKIP_SERVICE_REGISTRATION` | unset | `true` in tests |
| `CONDUCTOR_URL` | unset | Needed for live execute / ensure-defaults apply |

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | prod guard + ensureDefaults |
| Integration | `npm run test:integration` | health/ready/info + CRUD/compile + execute (axios mocked) |
| All | `npm test` | unit + integration |
| Live e2e | needs conductor | Proxy path parked; root `e2e/catalog.js` + `e2e/wave-data-graphql.js` |

## Related

- Conductor seed / `managerServicePorts` → `3141`
- Live execute needs `api_manager` Data API via conductor
- Root [`GOLDEN_PATH.md`](../../GOLDEN_PATH.md)
