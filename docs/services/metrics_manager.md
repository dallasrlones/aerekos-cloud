# metrics_manager — CloudWatch Metrics

> **Observability** · Implemented

Stored metric samples (name/value/labels). Aggregation cluster is future work.

- **Port:** `3105`
- **AWS analog:** CloudWatch Metrics
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/metrics_manager{path}` (JWT or service token)
- **Capabilities:** `metrics`, `samples`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/series` | Create a sery ({ project_id, name, ... }) |
| `GET` | `/api/v1/series` | List series (?project_id=) |
| `GET` | `/api/v1/series/:id` | Get one sery |
| `PATCH` | `/api/v1/series/:id` | Update a sery |
| `DELETE` | `/api/v1/series/:id` | Delete a sery |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/metrics_manager/api/v1/series?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
const r = client.resource('metrics_manager', 'series');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos metrics_manager series create --project $PID --data '{"name":"demo"}'
aerekos metrics_manager series list --project $PID
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._
