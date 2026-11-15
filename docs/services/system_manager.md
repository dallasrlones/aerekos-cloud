# system_manager — Systems Manager

> **Platform** · Implemented

Maintenance **task** specs (CRUD) in SQLite plus **host OS/Docker check+update** proxied to conductor `/api/workers/:id/host/*` (real probe on the worker). Not AWS SSM. Always-on per device; no project enable for host routes. `SKIP_HOST_PATCH` is test/dev only (refused in production via `assertNoSkipFakes`). **Tutorial / ServiceGuide:** none standalone — console generic **ManagerConsole** (no dedicated `CONSOLE_GUIDES` entry).

- **Port:** `3127`
- **AWS analog:** Systems Manager
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/system_manager{path}` (JWT or service token)
- **Capabilities:** `maintenance`, `tasks`
- **OpenAPI:** `worker/system_manager/api/openapi.yaml` (pack copy: `docs/openapi/system_manager.yaml`)
- **SDK/CLI:** `client.resource('system_manager', 'tasks')`; CLI `aerekos system_manager tasks …` / `aerekos call`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `POST` | `/api/v1/tasks` | Create a task ({ project_id, name, ... }) |
| `GET` | `/api/v1/tasks` | List tasks (?project_id=) |
| `GET` | `/api/v1/tasks/:id` | Get one task |
| `PATCH` | `/api/v1/tasks/:id` | Update a task |
| `POST` | `/api/v1/tasks/:id/run` | Run from spec_json (image or url) |
| `DELETE` | `/api/v1/tasks/:id` | Delete a task |
| `GET` | `/api/v1/hosts/:workerId/check` | Host OS/Docker freshness (conductor proxy) |
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

curl -s \
  "$CONDUCTOR/api/services/system_manager/api/v1/hosts/$WORKER_ID/check" \
  -H "Authorization: Bearer $TOKEN"
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
aerekos call system_manager GET "/api/v1/hosts/$WORKER_ID/check"
```

---

_Hand-aligned with `worker/system_manager` for Wave 7 closeout honesty. Catalog CRUD + host proxy also live in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._
