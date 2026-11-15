# vpn_manager — Client VPN

> **Edge** · Implemented

Project-scoped VPN peer rows plus Headscale preauth keys when `HEADSCALE_URL` + `HEADSCALE_API_KEY` are set; otherwise status/preauth report not-hooked-up (503 on create). **Tutorial / ServiceGuide:** none standalone — console generic **ManagerConsole**. No production skip-fake mocks (`assertNoSkipFakes` on boot). Live conductor e2e parked.

- **Port:** `3147`
- **AWS analog:** Client VPN
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/vpn_manager{path}` (JWT or service token)
- **Capabilities:** `vpn`
- **OpenAPI:** `worker/vpn_manager/api/openapi.yaml` (pack copy: `docs/openapi/vpn_manager.yaml`)
- **SDK/CLI:** `client.resource('vpn_manager', 'peers')`; CLI `aerekos vpn_manager peers …` / `aerekos call`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `GET` | `/api/v1/status` | Headscale hookup status |
| `POST` | `/api/v1/ensure-defaults` | Seed default laptop peer if missing |
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
aerekos call vpn_manager GET "/api/v1/status"
```

---

_Hand-aligned with `worker/vpn_manager` for Wave 7 closeout honesty. Catalog CRUD also lives in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._
