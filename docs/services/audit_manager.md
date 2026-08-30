# audit_manager — CloudTrail

> **Observability** · Implemented

Audit events.

- **Port:** `3149`
- **AWS analog:** CloudTrail
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/audit_manager{path}` (JWT or service token)
- **Capabilities:** `audit`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/events` | Create a event ({ project_id, name, ... }) |
| `GET` | `/api/v1/events` | List events (?project_id=) |
| `GET` | `/api/v1/events/:id` | Get one event |
| `PATCH` | `/api/v1/events/:id` | Update a event |
| `DELETE` | `/api/v1/events/:id` | Delete a event |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/audit_manager/api/v1/events?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
const r = client.resource('audit_manager', 'events');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos audit_manager events create --project $PID --data '{"name":"demo"}'
aerekos audit_manager events list --project $PID
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._
