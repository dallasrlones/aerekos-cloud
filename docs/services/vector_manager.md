# vector_manager — OpenSearch kNN

> **AI** · Implemented

Upsert/query via db_manager vectors or sqlite cosine (facade, not a second RAG). **Tutorial:** none. No prod mocks.

- **Port:** `3152`
- **AWS analog:** OpenSearch kNN
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/vector_manager{path}` (JWT or service token)
- **Capabilities:** `vector`, `embeddings`
- **OpenAPI:** `worker/vector_manager/api/openapi.yaml` (pack copy: `docs/openapi/vector_manager.yaml`)

## Honesty

| Claim | Reality |
|-------|---------|
| OpenSearch | Analog only — no OpenSearch cluster |
| Dataplane | SQLite cosine sidecar by default; db_manager when conductor reachable |
| Tutorial / ServiceGuide | none (ManagerConsole catalog entry only) |

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `POST` | `/api/v1/ensure-defaults` | Seed default `rag` index if empty |
| `POST` | `/api/v1/indexes` | Create an index (`project_id`, `name`, …) |
| `GET` | `/api/v1/indexes` | List indexes (`?project_id=`) |
| `GET` | `/api/v1/indexes/:id` | Get one index |
| `PATCH` | `/api/v1/indexes/:id` | Update an index |
| `DELETE` | `/api/v1/indexes/:id` | Delete an index |
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

curl -s -X POST \
  "$CONDUCTOR/api/services/vector_manager/api/v1/upsert" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","index":"default","items":[{"id":"a","vector":[1,0,0]}]}'
```

**SDK (Node)**

```js
const r = client.resource('vector_manager', 'indexes');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
// upsert/query — generic proxy (no client.vector helper):
await client.proxy('vector_manager', {
  method: 'POST', path: '/api/v1/query', projectId: PID,
  body: { project_id: PID, vector: [1, 0, 0], top_k: 5 },
});
```

**CLI**

```bash
aerekos vector_manager indexes create --project $PID --data '{"name":"demo"}'
aerekos vector_manager indexes list --project $PID
# upsert/query: aerekos call or curl
```

---

_Hand-aligned with `worker/vector_manager` for closeout honesty. Catalog CRUD + upsert/query also live in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._
