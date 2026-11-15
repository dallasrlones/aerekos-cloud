# email_manager — SES

> **Integrations** · Implemented · needs provider keys for live calls

Project-scoped email message rows (`to`/`subject`/`body`) plus optional `send`. Live SMTP only when secrets exist; otherwise queue-only. **Tutorial / ServiceGuide:** none standalone — console generic **ManagerConsole** (no dedicated `CONSOLE_GUIDES` entry). No production `SKIP_SMTP` / `SKIP_OUTBOUND` mocks.

- **Port:** `3113`
- **AWS analog:** SES
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/email_manager{path}` (JWT or service token)
- **Capabilities:** `email`
- **OpenAPI:** `worker/email_manager/api/openapi.yaml` (pack copy: `docs/openapi/email_manager.yaml`)
- **SDK/CLI:** `client.resource('email_manager', 'messages')`; CLI `aerekos email_manager messages …` / `aerekos call`

> ⚠️ **Provider activation:** Queued only without SMTP secrets (`needs-keys`). Do not retry live SMTP send in e2e without keys.

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
| `POST` | `/api/v1/messages/:id/send` | Attempt SMTP send / stay queued |
| `DELETE` | `/api/v1/messages/:id` | Delete a message |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/email_manager/api/v1/messages?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo","to_address":"a@b.example","subject":"hi","body":"hello"}'
```

**SDK (Node)**

```js
const r = client.resource('email_manager', 'messages');
await r.create(PID, { name: 'demo', to_address: 'a@b.example', subject: 'hi', body: 'hello' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos email_manager messages create --project $PID --data '{"name":"demo","to_address":"a@b.example","subject":"hi","body":"hello"}'
aerekos email_manager messages list --project $PID
aerekos call email_manager POST "/api/v1/messages/{id}/send" --project $PID
```

---

_Hand-aligned with `worker/email_manager` for Wave 5 closeout honesty. Catalog CRUD also lives in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._
