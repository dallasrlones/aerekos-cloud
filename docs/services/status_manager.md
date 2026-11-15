# status_manager — Statuspage

> **Observability** · Implemented

Project-scoped **status incidents** (CRUD) plus `GET /api/v1/public` (aggregate `ok` / `degraded` from non-resolved incidents) and `POST /api/v1/ensure-defaults` (seeds `all-clear` when empty). Statuspage is a naming analog only — no Atlassian Statuspage client. No production mocks (`assertNoSkipFakes` via index + `createManagerApp`). **Tutorial / ServiceGuide:** none standalone — console generic **ManagerConsole** (no dedicated `CONSOLE_GUIDES` entry). Live conductor e2e parked.

- **Port:** `3150`
- **AWS analog:** Statuspage
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/status_manager{path}` (JWT or service token)
- **Capabilities:** `status`
- **OpenAPI:** `worker/status_manager/api/openapi.yaml` (pack copy: `docs/openapi/status_manager.yaml`)
- **SDK/CLI:** `client.resource('status_manager', 'incidents')`; CLI `aerekos status_manager incidents …` / `aerekos call`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `POST` | `/api/v1/ensure-defaults` | Seed `all-clear` if missing |
| `GET` | `/api/v1/public` | Aggregate status (`?project_id=`) |
| `POST` | `/api/v1/incidents` | Create an incident ({ project_id, name, ... }) |
| `GET` | `/api/v1/incidents` | List incidents (?project_id=) |
| `GET` | `/api/v1/incidents/:id` | Get one incident |
| `PATCH` | `/api/v1/incidents/:id` | Update an incident |
| `DELETE` | `/api/v1/incidents/:id` | Delete an incident |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/status_manager/api/v1/incidents?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo","state":"investigating"}'

curl -s \
  "$CONDUCTOR/api/services/status_manager/api/v1/public?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN"
```

**SDK (Node)**

```js
const r = client.resource('status_manager', 'incidents');
await r.create(PID, { name: 'demo', state: 'investigating' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos status_manager incidents create --project $PID --data '{"name":"demo","state":"investigating"}'
aerekos status_manager incidents list --project $PID
aerekos call status_manager GET "/api/v1/public?project_id=$PID"
```

---

_Hand-aligned with `worker/status_manager` for Wave 7 closeout honesty. Catalog CRUD also lives in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._
