# config_manager — AppConfig

> **Identity** · Implemented

Config namespaces plus `/evaluate` against stored flags. No production mocks. **Tutorial:** none.

- **Port:** `3136`
- **AWS analog:** AppConfig
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/config_manager{path}` (JWT or service token)
- **Capabilities:** `config`, `flags`
- **OpenAPI:** `worker/config_manager/api/openapi.yaml` (pack copy: `docs/openapi/config_manager.yaml`)

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `POST` | `/api/v1/ensure-defaults` | Seed default `app` namespace if empty |
| `POST` | `/api/v1/namespaces` | Create a namespace (`project_id`, `name`, optional `flags`) |
| `GET` | `/api/v1/namespaces` | List namespaces (`?project_id=`) |
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
  -d '{"project_id":"'$PID'","name":"demo","flags":"{\"beta\":true}"}'

curl -s -X POST \
  "$CONDUCTOR/api/services/config_manager/api/v1/evaluate" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","namespace":"demo","flag":"beta"}'
```

**SDK (Node)**

```js
const r = client.resource('config_manager', 'namespaces');
await r.create(PID, { name: 'demo', flags: JSON.stringify({ beta: true }) });
console.log(await r.list(PID));
console.log(await client.config.evaluate(PID, { namespace: 'demo', flag: 'beta' }));
```

**CLI**

```bash
aerekos config_manager namespaces create --project $PID --data '{"name":"demo","flags":"{\"beta\":true}"}'
aerekos config_manager namespaces list --project $PID
```

Evaluate has no dedicated CLI verb yet — use SDK or curl to `/api/v1/evaluate`.

---

_Hand-aligned with `worker/config_manager` for closeout honesty. Catalog CRUD + evaluate also live in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._
