# iot_manager — IoT Core

> **Edge** · Implemented

IoT thing records (name/topic/status) plus `ensure-defaults` and `publish` (websocket fan-out). No production mocks (`assertNoSkipFakes` via `createManagerApp`; `SKIP_OUTBOUND` also refused in production). **Tutorial:** none standalone — generic ManagerConsole (no dedicated IotManager ServiceGuide). Live MQTT broker parked.

- **Port:** `3140`
- **AWS analog:** IoT Core
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/iot_manager{path}` (JWT or service token)
- **Capabilities:** `iot`, `mqtt`
- **OpenAPI:** `worker/iot_manager/api/openapi.yaml` (pack copy: `docs/openapi/iot_manager.yaml`)
- **SDK/CLI:** generic `client.resource('iot_manager', 'things')` / `client.proxy`; CLI `aerekos iot_manager things …` / `aerekos call`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `POST` | `/api/v1/ensure-defaults` | Seed default thing if missing |
| `POST` | `/api/v1/publish` | Publish payload (websocket fan-out; may skip under `SKIP_OUTBOUND`) |
| `POST` | `/api/v1/things` | Create a thing ({ project_id, name, ... }) |
| `GET` | `/api/v1/things` | List things (?project_id=) |
| `GET` | `/api/v1/things/:id` | Get one thing |
| `PATCH`/`PUT` | `/api/v1/things/:id` | Update a thing |
| `DELETE` | `/api/v1/things/:id` | Delete a thing |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/iot_manager/api/v1/things?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'

curl -s -X POST \
  "$CONDUCTOR/api/services/iot_manager/api/v1/publish" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","topic":"demo","payload":{"ping":1}}'
```

**SDK (Node)**

```js
const r = client.resource('iot_manager', 'things');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos iot_manager things create --project $PID --data '{"name":"demo"}'
aerekos iot_manager things list --project $PID
```

---

_Hand-aligned with `worker/iot_manager` for Wave 5 closeout honesty. Catalog CRUD also lives in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._
