# mcp_manager

**AWS analog:** Bedrock Agents (tools) · **Port:** `3123`

Project-scoped **MCP tool registry** (CRUD `/api/v1/tools`) with `description` + `input_schema`, a static **platform-tools** catalog, and HTTP **invoke** against `input_schema.endpoint` (proxied via conductor when the path is relative). SQLite via `aerekos-record`. Does **not** spawn live MCP server processes. No production skip-fakes in the request path — `SKIP_SERVICE_REGISTRATION` is test/dev only.

## Status

**MVP / implemented** — tools CRUD, platform-tools catalog, invoke, `/health`, `/ready`, `/api/v1/info`, `/metrics`.

**Tutorial:** none standalone. Console uses generic **ManagerConsole** ServiceGuide for `mcp_manager`.

## Access

- Direct: `http://localhost:3123/...`
- Conductor proxy: `{CONDUCTOR}/api/services/mcp_manager{path}` (JWT or service token)

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`) |
| `GET` | `/api/v1/platform-tools` | Catalog schemas (backup/iac/edge/systems/graphql/search/stack); outbound send disabled |
| `POST` | `/api/v1/tools` | Create (`project_id`, `name`, optional `description`, `input_schema`) |
| `GET` | `/api/v1/tools` | List (`?project_id=`) |
| `GET` | `/api/v1/tools/:id` | Get one |
| `PATCH`/`PUT` | `/api/v1/tools/:id` | Update |
| `DELETE` | `/api/v1/tools/:id` | Delete |
| `POST` | `/api/v1/tools/:id/invoke` | Invoke against `input_schema.endpoint` |

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/mcp_manager.yaml`](../../docs/openapi/mcp_manager.yaml). Catalog mirror: [`docs/services/mcp_manager.md`](../../docs/services/mcp_manager.md).

## SDK / CLI

- **SDK (Node):** `client.resource('mcp_manager', 'tools')` (create/list/get/update/delete).
- **CLI:** `aerekos mcp_manager tools list|get|create|update|delete --project $PID` (and `-d` JSON for create/update). Invoke via SDK/`aerekos call` / curl.

## Quick start

```bash
cd worker/mcp_manager
npm install   # use Node 20 (.nvmrc)
npm start
# curl http://localhost:3123/health
```

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | platform-tools catalog names |
| Integration | `npm run test:integration` | health/ready/info, platform-tools, CRUD |
| All | `npm test` | unit + integration |
| E2E | [`tests/e2e/README.md`](./tests/e2e/README.md) | proxy + root `e2e/catalog.js` |

## Related

- Conductor registration / proxy · ManagerConsole ServiceGuide
- `ai_manager` (tool invoke consumer) · platform tool backends (backup/iac/edge/…)
- Root [`GOLDEN_PATH.md`](../../GOLDEN_PATH.md)
