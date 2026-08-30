# tunnel_manager — Cloudflare Tunnel

> **Edge** · Implemented · needs provider keys for live calls

Create/delete Cloudflare tunnels (cloudflared) from the edge to private origins. Token returned once on create.

- **Port:** `3110`
- **AWS analog:** Cloudflare Tunnel
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/tunnel_manager{path}` (JWT or service token)
- **Capabilities:** `tunnels`, `edge`

> ⚠️ **Provider activation:** CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID. SKIP_CLOUDFLARE=1 for tests.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/tunnels` | Create a tunnel |
| `GET` | `/api/v1/tunnels` | List tunnels |
| `GET` | `/api/v1/tunnels/:id` | Get a tunnel |
| `DELETE` | `/api/v1/tunnels/:id` | Delete a tunnel |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/tunnel_manager/api/v1/tunnels?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
// generic proxy
await client.proxy('tunnel_manager', { method: 'POST', path: '/api/v1/tunnels', projectId: PID, body: { name: 'demo' } });
```

**CLI**

```bash
aerekos call tunnel_manager POST "/api/v1/tunnels" --project $PID --data '{"name":"demo"}'
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._
