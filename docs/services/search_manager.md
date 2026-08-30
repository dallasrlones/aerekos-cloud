# search_manager — OpenSearch

> **Database** · Implemented

SQLite FTS search. POST /query returns real hits (empty only when the index is empty).

- **Port:** `3144`
- **AWS analog:** OpenSearch
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/search_manager{path}` (JWT or service token)
- **Capabilities:** `search`, `fts`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/indexes` | Create a indexe ({ project_id, name, ... }) |
| `GET` | `/api/v1/indexes` | List indexes (?project_id=) |
| `GET` | `/api/v1/indexes/:id` | Get one indexe |
| `PATCH` | `/api/v1/indexes/:id` | Update a indexe |
| `DELETE` | `/api/v1/indexes/:id` | Delete a indexe |
| `POST` | `/api/v1/index` | Index documents |
| `POST` | `/api/v1/query` | FTS query → { hits } |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/search_manager/api/v1/indexes?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
const r = client.resource('search_manager', 'indexes');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos search_manager indexes create --project $PID --data '{"name":"demo"}'
aerekos search_manager indexes list --project $PID
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._
