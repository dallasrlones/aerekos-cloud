# domain_manager — Route 53

> **Edge** · Implemented · needs provider keys for live calls

Cloudflare DNS records (CRUD per zone + project). Pairs with tunnel_manager for public hostnames.

- **Port:** `3111`
- **AWS analog:** Route 53
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/domain_manager{path}` (JWT or service token)
- **Capabilities:** `dns`, `edge`

> ⚠️ **Provider activation:** CLOUDFLARE_API_TOKEN. SKIP_CLOUDFLARE=1 for tests.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/dns/records` | Create a DNS record |
| `GET` | `/api/v1/dns/records` | List DNS records |
| `GET` | `/api/v1/dns/records/:id` | Get a record |
| `PATCH` | `/api/v1/dns/records/:id` | Update a record |
| `DELETE` | `/api/v1/dns/records/:id` | Delete a record |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/domain_manager/api/v1/dns/records?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
// generic proxy
await client.proxy('domain_manager', { method: 'POST', path: '/api/v1/dns/records', projectId: PID, body: { name: 'demo' } });
```

**CLI**

```bash
aerekos call domain_manager POST "/api/v1/dns/records" --project $PID --data '{"name":"demo"}'
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._
