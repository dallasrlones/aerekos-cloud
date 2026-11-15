# notebook_manager — SageMaker notebook

> **AI** · Implemented

Notebook records (name/image/url/status) plus `ensure-defaults` and `run` (compute_manager oneshot via conductor; honest `queued` when `CONDUCTOR_URL` unset). No production mocks (`assertNoSkipFakes` via `createManagerApp`). **Tutorial:** none standalone — generic ManagerConsole. Live conductor + compute run e2e parked.

- **Port:** `3142`
- **AWS analog:** SageMaker notebook
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/notebook_manager{path}` (JWT or service token)
- **Capabilities:** `notebook`
- **OpenAPI:** `worker/notebook_manager/api/openapi.yaml` (pack copy: `docs/openapi/notebook_manager.yaml`)
- **SDK/CLI:** generic `client.resource('notebook_manager', 'notebooks')` / `client.proxy`; CLI `aerekos notebook_manager notebooks …` / `aerekos call`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `POST` | `/api/v1/ensure-defaults` | Seed default notebook if missing |
| `POST` | `/api/v1/notebooks` | Create a notebook ({ project_id, name, ... }) |
| `GET` | `/api/v1/notebooks` | List notebooks (?project_id=) |
| `GET` | `/api/v1/notebooks/:id` | Get one notebook |
| `PATCH`/`PUT` | `/api/v1/notebooks/:id` | Update a notebook |
| `DELETE` | `/api/v1/notebooks/:id` | Delete a notebook |
| `POST` | `/api/v1/notebooks/:id/run` | Run via compute oneshot (queues without conductor) |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/notebook_manager/api/v1/notebooks?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'

curl -s -X POST \
  "$CONDUCTOR/api/services/notebook_manager/api/v1/notebooks/$ID/run?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{}'
```

**SDK (Node)**

```js
const r = client.resource('notebook_manager', 'notebooks');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos notebook_manager notebooks create --project $PID --data '{"name":"demo"}'
aerekos notebook_manager notebooks list --project $PID
```

---

_Hand-aligned with `worker/notebook_manager` for Wave 6 closeout honesty. Catalog CRUD also lives in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._
