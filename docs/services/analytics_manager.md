# analytics_manager — Pinpoint / Kinesis Analytics

> **Observability** · Implemented

Product analytics events (event/value/properties).

- **Port:** `3117`
- **AWS analog:** Pinpoint / Kinesis Analytics
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/analytics_manager{path}` (JWT or service token)
- **Capabilities:** `analytics`, `events`

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
  "$CONDUCTOR/api/services/analytics_manager/api/v1/events?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
const r = client.resource('analytics_manager', 'events');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos analytics_manager events create --project $PID --data '{"name":"demo"}'
aerekos analytics_manager events list --project $PID
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._
