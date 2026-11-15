# websocket_manager — API Gateway WebSocket

> **Dev tools** · Implemented

Project-scoped channel CRUD, in-process WSS subscribe at `/ws`, and HTTP publish. API Gateway WebSocket is a naming analog only (no AWS client). Distinct from conductor Socket.IO. **Tutorial / ServiceGuide:** none (ManagerConsole has no dedicated `CONSOLE_GUIDES` entry). No production mocks.

- **Port:** `3131`
- **AWS analog:** API Gateway WebSocket
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/websocket_manager{path}` (JWT or service token)
- **Capabilities:** `realtime`, `websocket`
- **OpenAPI:** `worker/websocket_manager/api/openapi.yaml` (pack copy: `docs/openapi/websocket_manager.yaml`)

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `POST` | `/api/v1/ensure-defaults` | Seed default `app` channel if empty |
| `POST` | `/api/v1/channels` | Create a channel ({ project_id, name, ... }) |
| `GET` | `/api/v1/channels` | List channels (?project_id=) |
| `GET` | `/api/v1/channels/:id` | Get one channel |
| `PATCH` | `/api/v1/channels/:id` | Update a channel |
| `DELETE` | `/api/v1/channels/:id` | Delete a channel |
| `POST` | `/api/v1/publish` | Publish by channel name |
| `POST` | `/api/v1/channels/:id/publish` | Publish by channel id |
| `POST` | `/api/v1/internal/deliver` | Replica fan-out deliver |
| WSS | `/ws` | Subscribe (`?project_id=&channel=`) |

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

No dedicated `client.websocket` helper.

**CLI**

```bash
aerekos call websocket_manager POST "/api/v1/channels" --project $PID --data '{"name":"demo"}'
aerekos call websocket_manager POST "/api/v1/publish" --project $PID --data '{"channel":"app","payload":{"ping":1}}'
```

No dedicated `aerekos websocket` subcommand required for closeout.

---

_Hand-aligned with `worker/websocket_manager` for Wave 3 closeout honesty. Catalog extras also live in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._
