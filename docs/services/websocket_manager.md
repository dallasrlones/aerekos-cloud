# websocket_manager — API Gateway WebSocket

> **Dev tools** · Implemented

WebSocket channels.

- **Port:** `3131`
- **AWS analog:** API Gateway WebSocket
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/websocket_manager{path}` (JWT or service token)
- **Capabilities:** `realtime`, `websocket`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/channels` | Create a channel ({ project_id, name, ... }) |
| `GET` | `/api/v1/channels` | List channels (?project_id=) |
| `GET` | `/api/v1/channels/:id` | Get one channel |
| `PATCH` | `/api/v1/channels/:id` | Update a channel |
| `DELETE` | `/api/v1/channels/:id` | Delete a channel |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/websocket_manager/api/v1/channels?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
const r = client.resource('websocket_manager', 'channels');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos websocket_manager channels create --project $PID --data '{"name":"demo"}'
aerekos websocket_manager channels list --project $PID
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._
