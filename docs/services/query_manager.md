# query_manager — Athena

> **Observability** · Implemented

SQL queries.

- **Port:** `3145`
- **AWS analog:** Athena
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/query_manager{path}` (JWT or service token)
- **Capabilities:** `athena`, `sql`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/queries` | Create a query ({ project_id, name, ... }) |
| `GET` | `/api/v1/queries` | List queries (?project_id=) |
| `GET` | `/api/v1/queries/:id` | Get one query |
| `PATCH` | `/api/v1/queries/:id` | Update a query |
| `DELETE` | `/api/v1/queries/:id` | Delete a query |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/query_manager/api/v1/queries?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
const r = client.resource('query_manager', 'queries');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos query_manager queries create --project $PID --data '{"name":"demo"}'
aerekos query_manager queries list --project $PID
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._
