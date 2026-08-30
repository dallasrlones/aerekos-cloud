# system_manager — Systems Manager

> **Platform** · Implemented

Fleet patch board plus host OS/Docker check and update. Always on per device; no project enable.

- **Port:** `3127`
- **AWS analog:** Systems Manager
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/system_manager{path}` (JWT or service token)
- **Capabilities:** `maintenance`, `tasks`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/tasks` | Create a task ({ project_id, name, ... }) |
| `GET` | `/api/v1/tasks` | List tasks (?project_id=) |
| `GET` | `/api/v1/tasks/:id` | Get one task |
| `PATCH` | `/api/v1/tasks/:id` | Update a task |
| `DELETE` | `/api/v1/tasks/:id` | Delete a task |
| `GET` | `/api/v1/hosts/:workerId/check` | Host OS/Docker freshness |
| `POST` | `/api/v1/hosts/:workerId/check` | Re-probe host OS/Docker |
| `POST` | `/api/v1/hosts/:workerId/update` | Update host OS or Docker ({ target }) |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/system_manager/api/v1/tasks?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
const r = client.resource('system_manager', 'tasks');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos system_manager tasks create --project $PID --data '{"name":"demo"}'
aerekos system_manager tasks list --project $PID
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._
