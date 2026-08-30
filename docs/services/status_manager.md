# status_manager — Statuspage

> **Observability** · Implemented

Status incidents.

- **Port:** `3150`
- **AWS analog:** Statuspage
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/status_manager{path}` (JWT or service token)
- **Capabilities:** `status`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/incidents` | Create a incident ({ project_id, name, ... }) |
| `GET` | `/api/v1/incidents` | List incidents (?project_id=) |
| `GET` | `/api/v1/incidents/:id` | Get one incident |
| `PATCH` | `/api/v1/incidents/:id` | Update a incident |
| `DELETE` | `/api/v1/incidents/:id` | Delete a incident |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/status_manager/api/v1/incidents?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
const r = client.resource('status_manager', 'incidents');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos status_manager incidents create --project $PID --data '{"name":"demo"}'
aerekos status_manager incidents list --project $PID
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._
