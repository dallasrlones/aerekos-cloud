# graphql_manager — AppSync

> **Dev tools** · Implemented

GraphQL APIs compiled from Data API models. POST /execute runs queries against those models.

- **Port:** `3141`
- **AWS analog:** AppSync
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/graphql_manager{path}` (JWT or service token)
- **Capabilities:** `graphql`, `execute`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/apis` | Create a api ({ project_id, name, ... }) |
| `GET` | `/api/v1/apis` | List apis (?project_id=) |
| `GET` | `/api/v1/apis/:id` | Get one api |
| `PATCH` | `/api/v1/apis/:id` | Update a api |
| `DELETE` | `/api/v1/apis/:id` | Delete a api |
| `POST` | `/api/v1/compile` | Compile schema from Data API models |
| `POST` | `/api/v1/execute` | Execute a GraphQL query/mutation against Data API |

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
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._
