# graphql_manager — AppSync

> **Dev tools** · Implemented · live execute needs conductor + api_manager

Project-scoped GraphQL API metadata plus compile/execute against Data API models. Subset GraphQL only (no subscriptions / full AppSync). **Tutorial / ServiceGuide:** none standalone — console generic **ManagerConsole** (no dedicated `CONSOLE_GUIDES` entry). No production skip-fake mocks (`assertNoSkipFakes` via `createManagerApp`).

- **Port:** `3141`
- **AWS analog:** AppSync
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/graphql_manager{path}` (JWT or service token)
- **Capabilities:** `graphql`, `execute`
- **OpenAPI:** `worker/graphql_manager/api/openapi.yaml` (pack copy: `docs/openapi/graphql_manager.yaml`)
- **SDK/CLI:** `client.resource('graphql_manager', 'apis')`; CLI `aerekos graphql_manager apis …` / `aerekos call`

> ⚠️ **Live execute:** Conductor + `api_manager` Data API required for non-mocked `/execute` and ensure-defaults apply.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `POST` | `/api/v1/ensure-defaults` | Seed default `app` schema |
| `POST` | `/api/v1/compile` | Compile schema from Data API models |
| `POST` | `/api/v1/execute` | Execute a GraphQL query/mutation against Data API |
| `POST` | `/api/v1/apis` | Create a api ({ project_id, name, ... }) |
| `GET` | `/api/v1/apis` | List apis (?project_id=) |
| `GET` | `/api/v1/apis/:id` | Get one api |
| `PATCH` | `/api/v1/apis/:id` | Update a api |
| `DELETE` | `/api/v1/apis/:id` | Delete a api |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/graphql_manager/api/v1/apis?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
const r = client.resource('graphql_manager', 'apis');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos graphql_manager apis create --project $PID --data '{"name":"demo"}'
aerekos graphql_manager apis list --project $PID
aerekos call graphql_manager POST "/api/v1/execute" --project $PID --data '{"name":"app","query":"{ users { id name } }"}'
```

---

_Hand-aligned with `worker/graphql_manager` for Wave 5 closeout honesty. Catalog CRUD also lives in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._
