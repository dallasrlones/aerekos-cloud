# tunnel_manager — Cloudflare Tunnel

> **Edge** · Implemented · needs provider keys for live calls

Create/delete Cloudflare tunnels (cloudflared) from the edge to private origins, plus ingress merge/set and adopt/import/reconcile. Token returned once on create (never stored). Pairs with `domain_manager` for DNS/hostnames. **Tutorial / ServiceGuide:** none standalone — EdgeManager / ManagerConsole (no dedicated `CONSOLE_GUIDES` entry). No production `SKIP_CLOUDFLARE` mocks.

- **Port:** `3110`
- **AWS analog:** Cloudflare Tunnel
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/tunnel_manager{path}` (JWT or service token)
- **Capabilities:** `tunnels`, `edge`
- **OpenAPI:** `worker/tunnel_manager/api/openapi.yaml` (pack copy: `docs/openapi/tunnel_manager.yaml`)
- **SDK/CLI:** generic `client.proxy` / `aerekos call` (no uniform CRUD segment)

> ⚠️ **Provider activation:** `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` (catalog `needs-keys`). `SKIP_CLOUDFLARE=1` for tests/dev only.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `POST` | `/api/v1/tunnels` | Create a tunnel (token once) |
| `GET` | `/api/v1/tunnels` | List tunnels |
| `GET` | `/api/v1/tunnels/:id` | Get a tunnel |
| `DELETE` | `/api/v1/tunnels/:id` | Delete a tunnel |
| `GET`/`PATCH`/`PUT` | `/api/v1/tunnels/:id/ingress` | Ingress read / merge / replace |
| `POST` | `/api/v1/tunnels/adopt-known` | Adopt known CF tunnel ids |
| `POST` | `/api/v1/tunnels/import` | Import from Cloudflare |
| `POST` | `/api/v1/tunnels/reconcile` | Reconcile local vs CF |

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
await client.proxy('tunnel_manager', {
  method: 'POST',
  path: '/api/v1/tunnels',
  projectId: PID,
  body: { project_id: PID, name: 'demo' },
});
```

**CLI**

```bash
aerekos call tunnel_manager POST "/api/v1/tunnels" --project $PID --data '{"name":"demo"}'
```

---

_Hand-aligned with `worker/tunnel_manager` for Wave 7 closeout honesty. Catalog CRUD also lives in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._
