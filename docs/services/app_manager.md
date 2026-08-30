# app_manager — Amplify / App Runner

> **Dev tools** · Implemented

App project metadata (repo_url/build_command).

- **Port:** `3125`
- **AWS analog:** Amplify / App Runner
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/app_manager{path}` (JWT or service token)
- **Capabilities:** `apps`, `deploys`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/apps` | Create a app ({ project_id, name, ... }) |
| `GET` | `/api/v1/apps` | List apps (?project_id=) |
| `GET` | `/api/v1/apps/:id` | Get one app |
| `PATCH` | `/api/v1/apps/:id` | Update a app |
| `DELETE` | `/api/v1/apps/:id` | Delete a app |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/app_manager/api/v1/apps?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
const r = client.resource('app_manager', 'apps');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos app_manager apps create --project $PID --data '{"name":"demo"}'
aerekos app_manager apps list --project $PID
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._
