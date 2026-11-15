# slack_manager — Chatbot

> **Integrations** · Implemented · needs provider keys for live calls

Project-scoped Slack message rows (`channel`/`text`) plus optional `send`. Live Slack webhook/API only when secrets exist; otherwise queue-only. **Tutorial / ServiceGuide:** none standalone — console generic **ManagerConsole** (no dedicated `CONSOLE_GUIDES` entry). No production `SKIP_SLACK` / `SKIP_OUTBOUND` mocks.

- **Port:** `3115`
- **AWS analog:** Chatbot
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/slack_manager{path}` (JWT or service token)
- **Capabilities:** `slack`, `chatops`
- **OpenAPI:** `worker/slack_manager/api/openapi.yaml` (pack copy: `docs/openapi/slack_manager.yaml`)
- **SDK/CLI:** `client.resource('slack_manager', 'messages')`; CLI `aerekos slack_manager messages …` / `aerekos call`

> ⚠️ **Provider activation:** Queued only without Slack secrets (`needs-keys`). Do not retry live Slack post in e2e without keys.

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
| `POST` | `/api/v1/messages/:id/send` | Attempt Slack send / stay queued |
| `DELETE` | `/api/v1/messages/:id` | Delete a message |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/slack_manager/api/v1/messages?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo","channel":"#ops","text":"hello"}'
```

**SDK (Node)**

```js
const r = client.resource('slack_manager', 'messages');
await r.create(PID, { name: 'demo', channel: '#ops', text: 'hello' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos slack_manager messages create --project $PID --data '{"name":"demo","channel":"#ops","text":"hello"}'
aerekos slack_manager messages list --project $PID
aerekos call slack_manager POST "/api/v1/messages/{id}/send" --project $PID
```

---

_Hand-aligned with `worker/slack_manager` for Wave 6 closeout honesty. Catalog CRUD also lives in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._
