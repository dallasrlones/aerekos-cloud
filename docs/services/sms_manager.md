# sms_manager — SNS SMS

> **Integrations** · Implemented · needs provider keys for live calls

Project-scoped SMS message rows (`to_number`/`body`) plus optional `send`. Live Twilio only when secrets exist; otherwise queue-only. **Tutorial / ServiceGuide:** none standalone — console generic **ManagerConsole** (no dedicated `CONSOLE_GUIDES` entry). No production `SKIP_SMS` / `SKIP_OUTBOUND` mocks.

- **Port:** `3114`
- **AWS analog:** SNS SMS
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/sms_manager{path}` (JWT or service token)
- **Capabilities:** `sms`
- **OpenAPI:** `worker/sms_manager/api/openapi.yaml` (pack copy: `docs/openapi/sms_manager.yaml`)
- **SDK/CLI:** `client.resource('sms_manager', 'messages')`; CLI `aerekos sms_manager messages …` / `aerekos call`

> ⚠️ **Provider activation:** Queued only without Twilio secrets (`needs-keys`). Do not retry live Twilio send in e2e without keys.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `POST` | `/api/v1/messages` | Create a message ({ project_id, name, ... }) |
| `GET` | `/api/v1/messages` | List messages (?project_id=) |
| `GET` | `/api/v1/messages/:id` | Get one message |
| `PATCH` | `/api/v1/messages/:id` | Update a message |
| `POST` | `/api/v1/messages/:id/send` | Attempt SMS send / stay queued |
| `DELETE` | `/api/v1/messages/:id` | Delete a message |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/sms_manager/api/v1/messages?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo","to_number":"+15555550100","body":"hello"}'
```

**SDK (Node)**

```js
const r = client.resource('sms_manager', 'messages');
await r.create(PID, { name: 'demo', to_number: '+15555550100', body: 'hello' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos sms_manager messages create --project $PID --data '{"name":"demo","to_number":"+15555550100","body":"hello"}'
aerekos sms_manager messages list --project $PID
aerekos call sms_manager POST "/api/v1/messages/{id}/send" --project $PID
```

---

_Hand-aligned with `worker/sms_manager` for Wave 7 closeout honesty. Catalog CRUD also lives in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._
