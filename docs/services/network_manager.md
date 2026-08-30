# network_manager — VPC

> **Compute** · Implemented

Per-project Docker bridge networks with stable names. Attach service containers for isolation.

- **Port:** `3103`
- **AWS analog:** VPC
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/network_manager{path}` (JWT or service token)
- **Capabilities:** `networking`, `docker-networks`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/networks` | Create a network |
| `GET` | `/api/v1/networks` | List networks |
| `GET` | `/api/v1/networks/:id` | Get a network |
| `DELETE` | `/api/v1/networks/:id` | Delete a network |

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `SKIP_DOCKER` | `0` | Metadata-only mode |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/network_manager/api/v1/networks?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
// generic proxy
await client.proxy('network_manager', { method: 'POST', path: '/api/v1/networks', projectId: PID, body: { name: 'demo' } });
```

**CLI**

```bash
aerekos call network_manager POST "/api/v1/networks" --project $PID --data '{"name":"demo"}'
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._
