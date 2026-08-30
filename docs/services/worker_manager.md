# worker_manager — SSM fleet / tags

> **Platform** · Implemented

Worker/fleet labels synced from conductor /api/workers.

- **Port:** `3128`
- **AWS analog:** SSM fleet / tags
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/worker_manager{path}` (JWT or service token)
- **Capabilities:** `fleet`, `labels`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/annotations` | Create a annotation ({ project_id, name, ... }) |
| `GET` | `/api/v1/annotations` | List annotations (?project_id=) |
| `GET` | `/api/v1/annotations/:id` | Get one annotation |
| `PATCH` | `/api/v1/annotations/:id` | Update a annotation |
| `DELETE` | `/api/v1/annotations/:id` | Delete a annotation |
| `POST` | `/api/v1/sync` | Sync annotations from conductor workers |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/worker_manager/api/v1/annotations?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
const r = client.resource('worker_manager', 'annotations');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos worker_manager annotations create --project $PID --data '{"name":"demo"}'
aerekos worker_manager annotations list --project $PID
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._
