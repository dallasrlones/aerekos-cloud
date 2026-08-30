# registry_manager — ECR

> **Dev tools** · Implemented

Container registry discovery: per-project registry entries (no pull secrets) + a public config endpoint.

- **Port:** `3129`
- **AWS analog:** ECR
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/registry_manager{path}` (JWT or service token)
- **Capabilities:** `registry`, `oci`, `images`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/registries` | Create a registry entry |
| `GET` | `/api/v1/registries` | List entries |
| `GET` | `/api/v1/registries/:id` | Get an entry |
| `PATCH` | `/api/v1/registries/:id` | Update an entry |
| `DELETE` | `/api/v1/registries/:id` | Delete an entry |
| `GET` | `/api/v1/registry/config` | Public registry config (no secrets) |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/registry_manager/api/v1/registries?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
// generic proxy
await client.proxy('registry_manager', { method: 'POST', path: '/api/v1/registries', projectId: PID, body: { name: 'demo' } });
```

**CLI**

```bash
aerekos call registry_manager POST "/api/v1/registries" --project $PID --data '{"name":"demo"}'
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._
