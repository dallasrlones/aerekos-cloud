# security_manager — Security Hub

> **Observability** · Implemented

Security finding records (severity/source/details). Detectors wired later.

- **Port:** `3108`
- **AWS analog:** Security Hub
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/security_manager{path}` (JWT or service token)
- **Capabilities:** `security`, `findings`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/findings` | Create a finding ({ project_id, name, ... }) |
| `GET` | `/api/v1/findings` | List findings (?project_id=) |
| `GET` | `/api/v1/findings/:id` | Get one finding |
| `PATCH` | `/api/v1/findings/:id` | Update a finding |
| `DELETE` | `/api/v1/findings/:id` | Delete a finding |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/security_manager/api/v1/findings?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
const r = client.resource('security_manager', 'findings');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos security_manager findings create --project $PID --data '{"name":"demo"}'
aerekos security_manager findings list --project $PID
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._
