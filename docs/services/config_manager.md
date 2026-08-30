# config_manager — AppConfig

> **Identity** · Implemented

Config namespaces plus /evaluate against stored flags.

- **Port:** `3136`
- **AWS analog:** AppConfig
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/config_manager{path}` (JWT or service token)
- **Capabilities:** `config`, `flags`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/namespaces` | Create a namespace ({ project_id, name, ... }) |
| `GET` | `/api/v1/namespaces` | List namespaces (?project_id=) |
| `GET` | `/api/v1/namespaces/:id` | Get one namespace |
| `PATCH` | `/api/v1/namespaces/:id` | Update a namespace |
| `DELETE` | `/api/v1/namespaces/:id` | Delete a namespace |
| `POST` | `/api/v1/evaluate` | Evaluate flags from stored namespaces |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/config_manager/api/v1/namespaces?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
const r = client.resource('config_manager', 'namespaces');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos config_manager namespaces create --project $PID --data '{"name":"demo"}'
aerekos config_manager namespaces list --project $PID
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._
