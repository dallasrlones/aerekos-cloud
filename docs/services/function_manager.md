# function_manager — Lambda

> **Compute** · Implemented

Lambda analog. Deploy/invoke plus EventSource attach/detach. Always-on poller drains inbox queues; invoke failures nack toward DLQ. No production mocks (`assertNoSkipFakes` via `createManagerApp`). **Tutorial:** none standalone — console **FunctionManager** ServiceGuide.

- **Port:** `3139`
- **AWS analog:** Lambda
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/function_manager{path}` (JWT or service token)
- **Capabilities:** `lambda`, `functions`
- **OpenAPI:** `worker/function_manager/api/openapi.yaml` (pack copy: `docs/openapi/function_manager.yaml`)
- **SDK/CLI:** `client.functions.deploy|invoke|attachQueue|detachQueue`; CLI `aerekos function_manager functions …` / `aerekos call`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `POST` | `/api/v1/ensure-defaults` | Seed default `hello` function if missing |
| `POST` | `/api/v1/functions` | Create a function ({ project_id, name, ... }) |
| `GET` | `/api/v1/functions` | List functions (?project_id=) |
| `GET` | `/api/v1/functions/:id` | Get one function |
| `PATCH` | `/api/v1/functions/:id` | Update a function |
| `DELETE` | `/api/v1/functions/:id` | Delete a function |
| `POST` | `/api/v1/functions/:id/event-sources` | Attach a queue (provision inbox+DLQ if missing) |
| `GET` | `/api/v1/functions/:id/event-sources` | List EventSource mappings |
| `DELETE` | `/api/v1/functions/:id/event-sources/:sid` | Detach a queue (does not delete it) |
| `POST` | `/api/v1/functions/:name/invoke` | Invoke a function |
| `POST` | `/api/v1/poll` | Drain one poll cycle for the project |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/function_manager/api/v1/functions?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'

curl -s -X POST \
  "$CONDUCTOR/api/services/function_manager/api/v1/functions/demo/invoke" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","payload":{"ping":1},"invocation_type":"RequestResponse"}'
```

**SDK (Node)**

```js
await client.functions.deploy(PID, { name: 'demo' });
console.log(await client.functions.invoke(PID, 'demo', { payload: { ping: 1 } }));
const r = client.resource('function_manager', 'functions');
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos function_manager functions create --project $PID --data '{"name":"demo"}'
aerekos function_manager functions list --project $PID
```

---

_Hand-aligned with `worker/function_manager` for Wave 2 closeout honesty. Catalog CRUD + invoke also live in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._
