# slack_manager — Chatbot

> **Integrations** · Implemented · needs provider keys for live calls

Slack posts (channel/text). Queued; outbound send disabled.

- **Port:** `3115`
- **AWS analog:** Chatbot
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/slack_manager{path}` (JWT or service token)
- **Capabilities:** `slack`, `chatops`

> ⚠️ **Provider activation:** Queued only this pass. Do not retry live Slack post.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/messages` | Create a message ({ project_id, name, ... }) |
| `GET` | `/api/v1/messages` | List messages (?project_id=) |
| `GET` | `/api/v1/messages/:id` | Get one message |
| `PATCH` | `/api/v1/messages/:id` | Update a message |
| `DELETE` | `/api/v1/messages/:id` | Delete a message |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/slack_manager/api/v1/messages?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
const r = client.resource('slack_manager', 'messages');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos slack_manager messages create --project $PID --data '{"name":"demo"}'
aerekos slack_manager messages list --project $PID
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._
