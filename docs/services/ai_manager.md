# ai_manager — Bedrock

> **AI** · Implemented · needs provider keys for live calls

Intelligence endpoints, providers, STT/TTS, usage. Invoke via pretty gateway URLs or the SDK.

- **Port:** `3126`
- **AWS analog:** Bedrock
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/ai_manager{path}` (JWT or service token)
- **Capabilities:** `ai`, `intelligence`, `stt`, `tts`

> ⚠️ **Provider activation:** LLM endpoint/URL + provider keys (e.g. Ollama URL) to run inference.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/intelligence` | Create a intelligence ({ project_id, name, ... }) |
| `GET` | `/api/v1/intelligence` | List intelligence (?project_id=) |
| `GET` | `/api/v1/intelligence/:id` | Get one intelligence |
| `PATCH` | `/api/v1/intelligence/:id` | Update a intelligence |
| `DELETE` | `/api/v1/intelligence/:id` | Delete a intelligence |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/ai_manager/api/v1/intelligence?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
const r = client.resource('ai_manager', 'intelligence');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos ai_manager intelligence create --project $PID --data '{"name":"demo"}'
aerekos ai_manager intelligence list --project $PID
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._
