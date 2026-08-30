# event_manager — EventBridge

> **Integrations** · Implemented

Event buses.

- **Port:** `3132`
- **AWS analog:** EventBridge
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/event_manager{path}` (JWT or service token)
- **Capabilities:** `events`, `bus`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/buses` | Create a buse ({ project_id, name, ... }) |
| `GET` | `/api/v1/buses` | List buses (?project_id=) |
| `GET` | `/api/v1/buses/:id` | Get one buse |
| `PATCH` | `/api/v1/buses/:id` | Update a buse |
| `DELETE` | `/api/v1/buses/:id` | Delete a buse |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/event_manager/api/v1/buses?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
const r = client.resource('event_manager', 'buses');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos event_manager buses create --project $PID --data '{"name":"demo"}'
aerekos event_manager buses list --project $PID
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._
