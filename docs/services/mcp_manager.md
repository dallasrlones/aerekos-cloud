# mcp_manager — Bedrock Agents (tools)

> **Dev tools** · Implemented

MCP tool registry (description + input_schema). GET /platform-tools lists schemas for backup/iac/edge/systems/graphql/search/stack. HTTP invoke against `input_schema.endpoint`. Does **not** spawn live MCP server processes. **Tutorial:** none standalone — console **ManagerConsole** ServiceGuide.

- **Port:** `3123`
- **AWS analog:** Bedrock Agents (tools)
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/mcp_manager{path}` (JWT or service token)
- **Capabilities:** `mcp`, `tools`
- **OpenAPI:** `worker/mcp_manager/api/openapi.yaml` (pack copy: `docs/openapi/mcp_manager.yaml`)
- **SDK/CLI:** `client.resource('mcp_manager', 'tools')`; CLI `aerekos mcp_manager tools …` / `aerekos call`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `GET` | `/api/v1/platform-tools` | Catalog input_schema for platform tools (backup, iac, edge, systems, graphql, search, stack) |
| `POST` | `/api/v1/tools` | Create a tool ({ project_id, name, ... }) |
| `GET` | `/api/v1/tools` | List tools (?project_id=) |
| `GET` | `/api/v1/tools/:id` | Get one tool |
| `PATCH` | `/api/v1/tools/:id` | Update a tool |
| `DELETE` | `/api/v1/tools/:id` | Delete a tool |
| `POST` | `/api/v1/tools/:id/invoke` | Invoke a registered tool against input_schema.endpoint |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/mcp_manager/api/v1/tools?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo","description":"d","input_schema":"{}"}'
```

**SDK (Node)**

```js
const r = client.resource('mcp_manager', 'tools');
await r.create(PID, { name: 'demo', description: 'd', input_schema: '{}' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos mcp_manager tools create --project $PID --data '{"name":"demo","description":"d","input_schema":"{}"}'
aerekos mcp_manager tools list --project $PID
```

---

_Hand-aligned with `worker/mcp_manager` for Wave 3 closeout honesty. Catalog CRUD + platform-tools/invoke also live in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._
