# workflow_manager — Step Functions

> **Compute** · Implemented

Run state machines (http, queue, wait, choice, function). Email/SMS/Slack steps are skipped.

- **Port:** `3135`
- **AWS analog:** Step Functions
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/workflow_manager{path}` (JWT or service token)
- **Capabilities:** `workflow`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/machines` | Create a machine ({ project_id, name, ... }) |
| `GET` | `/api/v1/machines` | List machines (?project_id=) |
| `GET` | `/api/v1/machines/:id` | Get one machine |
| `PATCH` | `/api/v1/machines/:id` | Update a machine |
| `DELETE` | `/api/v1/machines/:id` | Delete a machine |
| `POST` | `/api/v1/machines/:id/run` | Run a machine (skips email/sms/slack steps) |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/workflow_manager/api/v1/machines?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
const r = client.resource('workflow_manager', 'machines');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos workflow_manager machines create --project $PID --data '{"name":"demo"}'
aerekos workflow_manager machines list --project $PID
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._
