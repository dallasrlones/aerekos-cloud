# audit_manager — CloudTrail

> **Observability** · Implemented

Project-scoped audit events (name/actor/action/detail) plus ingest helper. SQLite via `aerekos-record`. No production mocks. **Tutorial:** none standalone — console **ManagerConsole** / ObservabilityPanel ServiceGuide.

- **Port:** `3149`
- **AWS analog:** CloudTrail
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/audit_manager{path}` (JWT or service token)
- **Capabilities:** `audit`
- **OpenAPI:** `worker/audit_manager/api/openapi.yaml` (pack copy: `docs/openapi/audit_manager.yaml`)
- **SDK/CLI:** `client.resource('audit_manager', 'events')`; CLI `aerekos audit_manager events …` / `aerekos call`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `POST` | `/api/v1/ensure-defaults` | Seed bootstrap event if missing |
| `POST` | `/api/v1/ingest` | Convenience writer ({ project_id, name, actor, action, detail }) |
| `POST` | `/api/v1/events` | Create a event ({ project_id, name, ... }) |
| `GET` | `/api/v1/events` | List events (?project_id=) |
| `GET` | `/api/v1/events/:id` | Get one event |
| `PATCH` | `/api/v1/events/:id` | Update a event |
| `DELETE` | `/api/v1/events/:id` | Delete a event |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/audit_manager/api/v1/events?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo","actor":"user","action":"create","detail":"{}"}'
```

**SDK (Node)**

```js
const r = client.resource('audit_manager', 'events');
await r.create(PID, { name: 'demo', actor: 'user', action: 'create', detail: '{}' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos audit_manager events create --project $PID --data '{"name":"demo","actor":"user","action":"create","detail":"{}"}'
aerekos audit_manager events list --project $PID
```

---

_Hand-aligned with `worker/audit_manager` for Wave 4 closeout honesty. Catalog CRUD also lives in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._
