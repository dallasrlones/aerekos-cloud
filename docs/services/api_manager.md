# api_manager — API Gateway

> **Dev tools** · Implemented

Gateway route definitions (method/public_path/backend_url).

- **Port:** `3124`
- **AWS analog:** API Gateway
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/api_manager{path}` (JWT or service token)
- **Capabilities:** `api-gateway`, `routing`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/endpoints` | Create a endpoint ({ project_id, name, ... }) |
| `GET` | `/api/v1/endpoints` | List endpoints (?project_id=) |
| `GET` | `/api/v1/endpoints/:id` | Get one endpoint |
| `PATCH` | `/api/v1/endpoints/:id` | Update a endpoint |
| `DELETE` | `/api/v1/endpoints/:id` | Delete a endpoint |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/api_manager/api/v1/endpoints?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
const r = client.resource('api_manager', 'endpoints');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos api_manager endpoints create --project $PID --data '{"name":"demo"}'
aerekos api_manager endpoints list --project $PID
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._
