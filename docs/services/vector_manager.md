# vector_manager — OpenSearch kNN

> **AI** · Implemented

Upsert/query via db_manager vectors or sqlite cosine (facade, not a second RAG).

- **Port:** `3152`
- **AWS analog:** OpenSearch kNN
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/vector_manager{path}` (JWT or service token)
- **Capabilities:** `vector`, `embeddings`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/indexes` | Create a indexe ({ project_id, name, ... }) |
| `GET` | `/api/v1/indexes` | List indexes (?project_id=) |
| `GET` | `/api/v1/indexes/:id` | Get one indexe |
| `PATCH` | `/api/v1/indexes/:id` | Update a indexe |
| `DELETE` | `/api/v1/indexes/:id` | Delete a indexe |
| `POST` | `/api/v1/upsert` | Upsert vectors |
| `POST` | `/api/v1/query` | Query nearest neighbors |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/vector_manager/api/v1/indexes?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
const r = client.resource('vector_manager', 'indexes');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos vector_manager indexes create --project $PID --data '{"name":"demo"}'
aerekos vector_manager indexes list --project $PID
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._
