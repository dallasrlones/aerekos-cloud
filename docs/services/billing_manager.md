# billing_manager — Cost Explorer

> **Management** · Implemented

Usage meters. /evaluate-quota uses real counts and denies when over; never { unlimited: true }.

- **Port:** `3138`
- **AWS analog:** Cost Explorer
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/billing_manager{path}` (JWT or service token)
- **Capabilities:** `billing`, `quotas`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/meters` | Create a meter ({ project_id, name, ... }) |
| `GET` | `/api/v1/meters` | List meters (?project_id=) |
| `GET` | `/api/v1/meters/:id` | Get one meter |
| `PATCH` | `/api/v1/meters/:id` | Update a meter |
| `DELETE` | `/api/v1/meters/:id` | Delete a meter |
| `POST` | `/api/v1/evaluate-quota` | Evaluate quota (deny when over) |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/billing_manager/api/v1/meters?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
const r = client.resource('billing_manager', 'meters');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos billing_manager meters create --project $PID --data '{"name":"demo"}'
aerekos billing_manager meters list --project $PID
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._
