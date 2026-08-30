# iot_manager — IoT Core

> **Edge** · Implemented

IoT things.

- **Port:** `3140`
- **AWS analog:** IoT Core
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/iot_manager{path}` (JWT or service token)
- **Capabilities:** `iot`, `mqtt`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/things` | Create a thing ({ project_id, name, ... }) |
| `GET` | `/api/v1/things` | List things (?project_id=) |
| `GET` | `/api/v1/things/:id` | Get one thing |
| `PATCH` | `/api/v1/things/:id` | Update a thing |
| `DELETE` | `/api/v1/things/:id` | Delete a thing |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/iot_manager/api/v1/things?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
const r = client.resource('iot_manager', 'things');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos iot_manager things create --project $PID --data '{"name":"demo"}'
aerekos iot_manager things list --project $PID
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._
