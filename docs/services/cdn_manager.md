# cdn_manager — CloudFront

> **Edge** · Implemented

CDN-style cache rules (path pattern, origin, TTL). Config only in MVP.

- **Port:** `3118`
- **AWS analog:** CloudFront
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/cdn_manager{path}` (JWT or service token)
- **Capabilities:** `cdn`, `cache-rules`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/rules` | Create a rule ({ project_id, name, ... }) |
| `GET` | `/api/v1/rules` | List rules (?project_id=) |
| `GET` | `/api/v1/rules/:id` | Get one rule |
| `PATCH` | `/api/v1/rules/:id` | Update a rule |
| `DELETE` | `/api/v1/rules/:id` | Delete a rule |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/cdn_manager/api/v1/rules?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
const r = client.resource('cdn_manager', 'rules');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos cdn_manager rules create --project $PID --data '{"name":"demo"}'
aerekos cdn_manager rules list --project $PID
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._
