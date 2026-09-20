# mcp_manager — Bedrock Agents (tools)

> **Dev tools** · Implemented

MCP tool registry (description + input_schema). GET /platform-tools lists schemas for backup/iac/edge/systems/graphql/search.

- **Port:** `3123`
- **AWS analog:** Bedrock Agents (tools)
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/mcp_manager{path}` (JWT or service token)
- **Capabilities:** `mcp`, `tools`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/tools` | Create a tool ({ project_id, name, ... }) |
| `GET` | `/api/v1/tools` | List tools (?project_id=) |
| `GET` | `/api/v1/tools/:id` | Get one tool |
| `PATCH` | `/api/v1/tools/:id` | Update a tool |
| `DELETE` | `/api/v1/tools/:id` | Delete a tool |
| `GET` | `/api/v1/platform-tools` | Catalog input_schema for platform tools (backup, iac, edge, systems, graphql, search, stack) |
| `POST` | `/api/v1/tools/:id/invoke` | Invoke a registered tool against input_schema.endpoint |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/mcp_manager/api/v1/tools?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
const r = client.resource('mcp_manager', 'tools');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos mcp_manager tools create --project $PID --data '{"name":"demo"}'
aerekos mcp_manager tools list --project $PID
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._
