# push_manager — SNS mobile

> **Integrations** · Implemented · needs provider keys for live calls

Project-scoped push subscription rows (`name`/`endpoint`/`kind`) plus optional `send`. Live FCM only when `FCM_SERVER_KEY` (+ device token) exist; otherwise queue-only. **Tutorial / ServiceGuide:** none standalone — console generic **ManagerConsole** (no dedicated `CONSOLE_GUIDES` entry). No production `SKIP_PUSH` / `SKIP_OUTBOUND` mocks.

- **Port:** `3153`
- **AWS analog:** SNS mobile
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/push_manager{path}` (JWT or service token)
- **Capabilities:** `push`
- **OpenAPI:** `worker/push_manager/api/openapi.yaml` (pack copy: `docs/openapi/push_manager.yaml`)
- **SDK/CLI:** `client.resource('push_manager', 'subscriptions')`; CLI `aerekos push_manager subscriptions …` / `aerekos call`

> ⚠️ **Provider activation:** Queued only without FCM secrets (`needs-keys`). Do not retry live FCM send in e2e without keys. Live conductor proxy e2e parked.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `POST` | `/api/v1/ensure-defaults` | Seed default subscription if missing |
| `POST` | `/api/v1/send` | Attempt FCM send / stay queued |
| `POST` | `/api/v1/subscriptions` | Create a subscription ({ project_id, name, ... }) |
| `GET` | `/api/v1/subscriptions` | List subscriptions (?project_id=) |
| `GET` | `/api/v1/subscriptions/:id` | Get one subscription |
| `PATCH` | `/api/v1/subscriptions/:id` | Update a subscription |
| `DELETE` | `/api/v1/subscriptions/:id` | Delete a subscription |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/push_manager/api/v1/subscriptions?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo","endpoint":"device-token","kind":"web"}'

curl -s -X POST \
  "$CONDUCTOR/api/services/push_manager/api/v1/send" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"to":"device-token","title":"hi","body":"hello"}'
```

**SDK (Node)**

```js
const r = client.resource('push_manager', 'subscriptions');
await r.create(PID, { name: 'demo', endpoint: 'device-token', kind: 'web' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos push_manager subscriptions create --project $PID --data '{"name":"demo","endpoint":"device-token","kind":"web"}'
aerekos push_manager subscriptions list --project $PID
aerekos call push_manager POST "/api/v1/send" --project $PID -d '{"to":"device-token","title":"hi","body":"hello"}'
```

---

_Hand-aligned with `worker/push_manager` for Wave 6 closeout honesty. Catalog CRUD also lives in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._
