# workflow_manager — Step Functions

> **Compute** · Implemented

Run state machines (`http`, `queue`, `wait`, `choice`, `function`). Email/SMS/Slack/push steps are **skipped** when outbound is disabled. **Not** full AWS ASL. **Tutorial:** none (generic ManagerConsole + ResourceCrud Run). No prod mocks.

- **Port:** `3135`
- **AWS analog:** Step Functions
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/workflow_manager{path}` (JWT or service token)
- **Capabilities:** `workflow`
- **OpenAPI:** `worker/workflow_manager/api/openapi.yaml` (pack copy: `docs/openapi/workflow_manager.yaml`)

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `POST` | `/api/v1/ensure-defaults` | Seed `hello` machine if empty |
| `POST` | `/api/v1/machines` | Create a machine (`project_id`, `name`, optional `definition`) |
| `GET` | `/api/v1/machines` | List machines (`?project_id=`) |
| `GET` | `/api/v1/machines/:id` | Get one machine |
| `PATCH` | `/api/v1/machines/:id` | Update a machine |
| `DELETE` | `/api/v1/machines/:id` | Delete a machine |
| `POST` | `/api/v1/machines/:id/run` | Run a machine (skips email/sms/slack/push when outbound disabled) |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/workflow_manager/api/v1/machines?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'

curl -s -X POST \
  "$CONDUCTOR/api/services/workflow_manager/api/v1/machines/$MID/run" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'"}'
```

**SDK (Node)**

```js
const r = client.resource('workflow_manager', 'machines');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos call workflow_manager POST "/api/v1/machines" --project $PID --data '{"name":"demo"}'
aerekos call workflow_manager GET "/api/v1/machines?project_id=$PID"
```

---

_Hand-aligned with `worker/workflow_manager` for Wave 2 closeout honesty. Catalog extras live in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._
