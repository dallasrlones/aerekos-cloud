# vpn_manager — Client VPN

> **Edge** · Implemented

Headscale preauth keys when HEADSCALE_URL is set; otherwise not-hooked-up.

- **Port:** `3147`
- **AWS analog:** Client VPN
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/vpn_manager{path}` (JWT or service token)
- **Capabilities:** `vpn`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/peers` | Create a peer ({ project_id, name, ... }) |
| `GET` | `/api/v1/peers` | List peers (?project_id=) |
| `GET` | `/api/v1/peers/:id` | Get one peer |
| `PATCH` | `/api/v1/peers/:id` | Update a peer |
| `DELETE` | `/api/v1/peers/:id` | Delete a peer |
| `POST` | `/api/v1/preauth-keys` | Create a Headscale preauth key (or not-hooked-up) |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/vpn_manager/api/v1/peers?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
const r = client.resource('vpn_manager', 'peers');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos vpn_manager peers create --project $PID --data '{"name":"demo"}'
aerekos vpn_manager peers list --project $PID
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._
