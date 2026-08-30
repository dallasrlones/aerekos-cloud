# transfer_manager — Transfer Family

> **Storage & Content** · Implemented

SFTP endpoints that put/get objects through storage_manager.

- **Port:** `3148`
- **AWS analog:** Transfer Family
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/transfer_manager{path}` (JWT or service token)
- **Capabilities:** `sftp`, `transfer`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/endpoints` | Create a endpoint ({ project_id, name, ... }) |
| `GET` | `/api/v1/endpoints` | List endpoints (?project_id=) |
| `GET` | `/api/v1/endpoints/:id` | Get one endpoint |
| `PATCH` | `/api/v1/endpoints/:id` | Update a endpoint |
| `DELETE` | `/api/v1/endpoints/:id` | Delete a endpoint |
| `POST` | `/api/v1/endpoints/:id/put` | Write an object via storage_manager |
| `POST` | `/api/v1/endpoints/:id/get` | Read an object via storage_manager |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/transfer_manager/api/v1/endpoints?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
const r = client.resource('transfer_manager', 'endpoints');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos transfer_manager endpoints create --project $PID --data '{"name":"demo"}'
aerekos transfer_manager endpoints list --project $PID
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._
