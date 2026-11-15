# transfer_manager — Transfer Family

> **Storage & Content** · Implemented

SFTP-style **endpoint** metadata (CRUD) plus `ensure-defaults`, and put/get object copy through `storage_manager` via the conductor proxy. No production mocks (`assertNoSkipFakes` via index + `createManagerApp`). **Tutorial:** none standalone — generic ManagerConsole (no dedicated TransferManager ServiceGuide). Live conductor e2e parked. **Not** a live SFTP daemon — Transfer Family naming analog only; put/get require `CONDUCTOR_URL`.

- **Port:** `3148`
- **AWS analog:** Transfer Family
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/transfer_manager{path}` (JWT or service token)
- **Capabilities:** `sftp`, `transfer`
- **OpenAPI:** `worker/transfer_manager/api/openapi.yaml` (pack copy: `docs/openapi/transfer_manager.yaml`)
- **SDK/CLI:** generic `client.resource('transfer_manager', 'endpoints')` / `client.proxy`; CLI `aerekos transfer_manager endpoints …` / `aerekos call`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `POST` | `/api/v1/ensure-defaults` | Seed default `sftp` endpoint if missing |
| `POST` | `/api/v1/endpoints` | Create an endpoint ({ project_id, name, ... }) |
| `GET` | `/api/v1/endpoints` | List endpoints (?project_id=) |
| `GET` | `/api/v1/endpoints/:id` | Get one endpoint |
| `PATCH`/`PUT` | `/api/v1/endpoints/:id` | Update an endpoint |
| `DELETE` | `/api/v1/endpoints/:id` | Delete an endpoint |
| `POST` | `/api/v1/endpoints/:id/put` | Write an object via storage_manager |
| `POST` | `/api/v1/endpoints/:id/get` | Read an object via storage_manager |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/transfer_manager/api/v1/endpoints?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo","bucket":"demo"}'

curl -s -X POST \
  "$CONDUCTOR/api/services/transfer_manager/api/v1/endpoints/$EID/put?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"key":"a.txt","content":"hello"}'
```

**SDK (Node)**

```js
const r = client.resource('transfer_manager', 'endpoints');
await r.create(PID, { name: 'demo', bucket: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos transfer_manager endpoints create --project $PID --data '{"name":"demo","bucket":"demo"}'
aerekos transfer_manager endpoints list --project $PID
```

---

_Hand-aligned with `worker/transfer_manager` for Wave 7 closeout honesty. Catalog CRUD also lives in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._
