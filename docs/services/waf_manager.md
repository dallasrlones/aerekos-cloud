# waf_manager — WAF

> **Edge** · Implemented

WAF rules.

- **Port:** `3146`
- **AWS analog:** WAF
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/waf_manager{path}` (JWT or service token)
- **Capabilities:** `waf`

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
  "$CONDUCTOR/api/services/waf_manager/api/v1/rules?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
const r = client.resource('waf_manager', 'rules');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos waf_manager rules create --project $PID --data '{"name":"demo"}'
aerekos waf_manager rules list --project $PID
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._
