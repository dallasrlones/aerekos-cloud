# worker_manager — SSM fleet / tags

> **Platform** · Implemented

Project-scoped worker/fleet annotations (`name`/`worker_id`/`key`/`value`) plus optional sync from conductor `/api/workers`. Not live AWS SSM; not the worker agent lifecycle. **Tutorial / ServiceGuide:** none standalone — console generic **ManagerConsole** (no dedicated `CONSOLE_GUIDES` entry). No production skip-fake mocks (`assertNoSkipFakes`). Live conductor e2e parked.

- **Port:** `3128`
- **AWS analog:** SSM fleet / tags
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/worker_manager{path}` (JWT or service token)
- **Capabilities:** `fleet`, `labels`
- **OpenAPI:** `worker/worker_manager/api/openapi.yaml` (pack copy: `docs/openapi/worker_manager.yaml`)
- **SDK/CLI:** `client.resource('worker_manager', 'annotations')`; CLI `aerekos worker_manager annotations …` / `aerekos call`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `POST` | `/api/v1/sync` | Sync annotations from conductor workers |
| `POST` | `/api/v1/annotations` | Create an annotation ({ project_id, name, ... }) |
| `GET` | `/api/v1/annotations` | List annotations (?project_id=) |
| `GET` | `/api/v1/annotations/:id` | Get one annotation |
| `PATCH` | `/api/v1/annotations/:id` | Update an annotation |
| `DELETE` | `/api/v1/annotations/:id` | Delete an annotation |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/worker_manager/api/v1/annotations?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo","worker_id":"w1","key":"region","value":"us"}'
```

**SDK (Node)**

```js
const r = client.resource('worker_manager', 'annotations');
await r.create(PID, { name: 'demo', worker_id: 'w1', key: 'region', value: 'us' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos worker_manager annotations create --project $PID --data '{"name":"demo","worker_id":"w1","key":"region","value":"us"}'
aerekos worker_manager annotations list --project $PID
aerekos call worker_manager POST "/api/v1/sync" --project $PID --data '{"project_id":"'"$PID"'"}'
```

---

_Hand-aligned with `worker/worker_manager` for Wave 8 closeout honesty. Catalog CRUD + sync also live in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._
