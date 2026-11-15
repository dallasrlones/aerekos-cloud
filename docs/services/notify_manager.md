# notify_manager — SNS / SES / Chatbot (unified)

> **Integrations** · Implemented · needs provider keys for live calls

Unified notify facade (W9a): project-scoped **messages** + **channels** CRUD, `POST …/send` and `POST /api/v1/test` via `worker/shared/notifyFacade`. Non-prod defaults `NOTIFY_USE_MOCK=1` (MockProvider — no paid APIs). Production refuses `NOTIFY_USE_MOCK` / `SKIP_OUTBOUND` (`assertNoSkipFakes`). Legacy email/sms/slack/push managers stay registered until Phase 2. **Tutorial / ServiceGuide:** none standalone — console generic **ManagerConsole**.

- **Port:** `3154`
- **AWS analog:** SNS / SES / Chatbot merge
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/notify_manager{path}` (JWT or service token)
- **Capabilities:** `notify`, `transactional`, `alerts`
- **OpenAPI:** `worker/notify_manager/api/openapi.yaml` (pack copy: `docs/openapi/notify_manager.yaml`)
- **SDK/CLI:** `client.resource('notify_manager', 'messages')`; CLI `aerekos notify_manager messages …` / `aerekos call`

> ⚠️ **Provider activation:** Mock/queue-only without channel secrets (`needs-keys`). Do not retry live send in e2e without keys. Live conductor e2e parked.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `POST` | `/api/v1/ensure-defaults` | Seed default message if missing |
| `GET` | `/api/v1/providers` | Channel provider descriptors |
| `POST` | `/api/v1/test` | Facade test send (mock by default) |
| `POST` | `/api/v1/messages` | Create a message ({ project_id, name, ... }) |
| `GET` | `/api/v1/messages` | List messages (?project_id=) |
| `GET` | `/api/v1/messages/:id` | Get one message |
| `PATCH`/`PUT` | `/api/v1/messages/:id` | Update a message |
| `POST` | `/api/v1/messages/:id/send` | Send via facade / stay queued |
| `DELETE` | `/api/v1/messages/:id` | Delete a message |
| `*` | `/api/v1/channels` | Channel config CRUD |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/notify_manager/api/v1/messages?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo","channel":"email","to_address":"a@b.example","subject":"hi","body":"hello"}'
```

**SDK (Node)**

```js
const r = client.resource('notify_manager', 'messages');
await r.create(PID, { name: 'demo', channel: 'email', to_address: 'a@b.example', subject: 'hi', body: 'hello' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos notify_manager messages create --project $PID --data '{"name":"demo","channel":"email","to_address":"a@b.example","subject":"hi","body":"hello"}'
aerekos notify_manager messages list --project $PID
aerekos call notify_manager POST "/api/v1/messages/{id}/send" --project $PID
```

---

_Hand-aligned with `worker/notify_manager` for Wave 6 closeout honesty. Catalog CRUD also lives in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._
