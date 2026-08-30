# host_manager — EC2 / SSM inventory

> **Platform** · Implemented

Host inventory synced from conductor /api/workers (not a second fleet to register by hand).

- **Port:** `3122`
- **AWS analog:** EC2 / SSM inventory
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/host_manager{path}` (JWT or service token)
- **Capabilities:** `inventory`, `hosts`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/hosts` | Create a host ({ project_id, name, ... }) |
| `GET` | `/api/v1/hosts` | List hosts (?project_id=) |
| `GET` | `/api/v1/hosts/:id` | Get one host |
| `PATCH` | `/api/v1/hosts/:id` | Update a host |
| `DELETE` | `/api/v1/hosts/:id` | Delete a host |
| `POST` | `/api/v1/sync` | Sync hosts from conductor workers |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/host_manager/api/v1/hosts?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
const r = client.resource('host_manager', 'hosts');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos host_manager hosts create --project $PID --data '{"name":"demo"}'
aerekos host_manager hosts list --project $PID
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._
