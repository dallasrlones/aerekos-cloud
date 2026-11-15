# app_manager — Amplify / App Runner

> **Dev tools** · Implemented

App project metadata (`repo_url` / `build_command`) plus FE scaffold for Icarus IDE. Amplify / App Runner is a naming analog only (no AWS client). **Deploy** is via compute/cicd/tunnel after scaffold — this manager does not ship images. **Tutorial / ServiceGuide:** none (no `CONSOLE_GUIDES.app_manager`; generic Applications ManagerConsole only). No production mocks — tests use temp SQLite + `SKIP_SERVICE_REGISTRATION`.

- **Port:** `3125`
- **AWS analog:** Amplify / App Runner
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/app_manager{path}` (JWT or service token)
- **Capabilities:** `apps`, `deploys`, `scaffold`
- **OpenAPI:** `worker/app_manager/api/openapi.yaml` (pack copy: `docs/openapi/app_manager.yaml`)

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `POST` | `/api/v1/apps` | Create an app ({ project_id, name, ... }) |
| `GET` | `/api/v1/apps` | List apps (?project_id=) |
| `GET` | `/api/v1/apps/:id` | Get one app |
| `PATCH` | `/api/v1/apps/:id` | Update an app |
| `DELETE` | `/api/v1/apps/:id` | Delete an app |
| `POST` | `/api/v1/apps/scaffold` | Scaffold FE starter files for Icarus IDE |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/app_manager/api/v1/apps?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'

curl -s -X POST \
  "$CONDUCTOR/api/services/app_manager/api/v1/apps/scaffold?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"fe","template":"admin_crud"}'
```

**SDK (Node)**

```js
const r = client.resource('app_manager', 'apps');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

No dedicated `client.app` helper.

**CLI**

```bash
aerekos call app_manager POST "/api/v1/apps" --project $PID --data '{"name":"demo"}'
aerekos call app_manager GET "/api/v1/apps?project_id=$PID"
```

No dedicated `aerekos app` subcommand.

---

_Hand-aligned with `worker/app_manager` for Wave 3 closeout honesty. Catalog extras live in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._
