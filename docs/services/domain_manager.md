# domain_manager — Route 53

> **Edge** · Implemented · needs provider keys for live calls

Cloudflare DNS records (CRUD per zone + project), zone list, and hostname bindings. Pairs with tunnel_manager for public hostnames. **Tutorial / ServiceGuide:** none standalone — EdgeManager / ManagerConsole (no dedicated `CONSOLE_GUIDES` entry). No production `SKIP_CLOUDFLARE` mocks.

- **Port:** `3111`
- **AWS analog:** Route 53
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/domain_manager{path}` (JWT or service token)
- **Capabilities:** `dns`, `edge`
- **OpenAPI:** `worker/domain_manager/api/openapi.yaml` (pack copy: `docs/openapi/domain_manager.yaml`)
- **SDK/CLI:** generic `client.proxy` / `aerekos call` (no uniform CRUD segment)

> ⚠️ **Provider activation:** `CLOUDFLARE_API_TOKEN` (catalog `needs-keys`). `SKIP_CLOUDFLARE=1` for tests/dev only.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `GET` | `/api/v1/dns/zones` | List Cloudflare zones |
| `POST` | `/api/v1/dns/records` | Create a DNS record |
| `GET` | `/api/v1/dns/records` | List DNS records |
| `GET` | `/api/v1/dns/records/:id` | Get a record |
| `PATCH` | `/api/v1/dns/records/:id` | Update a record |
| `DELETE` | `/api/v1/dns/records/:id` | Delete a record |
| `GET`/`POST` | `/api/v1/dns/hostnames` | List / create hostname bindings |
| `PATCH`/`DELETE` | `/api/v1/dns/hostnames/:id` | Update / delete binding |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/domain_manager/api/v1/dns/records?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","zone_id":"ZONE","name":"demo.example.com","record_type":"A","content":"192.0.2.1"}'
```

**SDK (Node)**

```js
await client.proxy('domain_manager', {
  method: 'POST',
  path: '/api/v1/dns/records',
  projectId: PID,
  body: { project_id: PID, zone_id: 'ZONE', name: 'demo.example.com', record_type: 'A', content: '192.0.2.1' },
});
```

**CLI**

```bash
aerekos call domain_manager POST "/api/v1/dns/records" --project $PID \
  --data '{"project_id":"'"$PID"'","zone_id":"ZONE","name":"demo.example.com","record_type":"A","content":"192.0.2.1"}'
```

---

_Hand-aligned with `worker/domain_manager` for Wave 5 closeout honesty. Catalog CRUD also lives in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._
