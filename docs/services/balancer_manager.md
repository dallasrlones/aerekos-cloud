# balancer_manager — ELB

> **Edge** · Implemented

Load-balancer target hints (addresses). No cloud LB provisioning in MVP.

- **Port:** `3109`
- **AWS analog:** ELB
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/balancer_manager{path}` (JWT or service token)
- **Capabilities:** `load-balancing`, `targets`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/targets` | Create a target ({ project_id, name, ... }) |
| `GET` | `/api/v1/targets` | List targets (?project_id=) |
| `GET` | `/api/v1/targets/:id` | Get one target |
| `PATCH` | `/api/v1/targets/:id` | Update a target |
| `DELETE` | `/api/v1/targets/:id` | Delete a target |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/balancer_manager/api/v1/targets?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
const r = client.resource('balancer_manager', 'targets');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos balancer_manager targets create --project $PID --data '{"name":"demo"}'
aerekos balancer_manager targets list --project $PID
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._
