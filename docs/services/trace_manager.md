# trace_manager — X-Ray

> **Observability** · Implemented

OTLP/HTTP ingest plus span list/query in SQLite.

- **Port:** `3143`
- **AWS analog:** X-Ray
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/trace_manager{path}` (JWT or service token)
- **Capabilities:** `tracing`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/traces` | Create a trace ({ project_id, name, ... }) |
| `GET` | `/api/v1/traces` | List traces (?project_id=) |
| `GET` | `/api/v1/traces/:id` | Get one trace |
| `PATCH` | `/api/v1/traces/:id` | Update a trace |
| `DELETE` | `/api/v1/traces/:id` | Delete a trace |
| `POST` | `/v1/traces` | OTLP HTTP ingest |
| `GET` | `/api/v1/spans` | List stored spans |
| `GET` | `/api/v1/query` | Query spans |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/trace_manager/api/v1/traces?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
const r = client.resource('trace_manager', 'traces');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos trace_manager traces create --project $PID --data '{"name":"demo"}'
aerekos trace_manager traces list --project $PID
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._
