# schedule_manager — EventBridge Scheduler

> **Compute** · Implemented

Cron schedules that dispatch to a webhook or a queue. Run-now supported.

- **Port:** `3102`
- **AWS analog:** EventBridge Scheduler
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/schedule_manager{path}` (JWT or service token)
- **Capabilities:** `cron`, `scheduling`, `dispatch`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/schedules` | Create a schedule (cron + target) |
| `GET` | `/api/v1/schedules` | List schedules |
| `GET` | `/api/v1/schedules/:id` | Get a schedule |
| `POST` | `/api/v1/schedules/:id/run` | Run now |
| `PATCH` | `/api/v1/schedules/:id` | Update a schedule |
| `DELETE` | `/api/v1/schedules/:id` | Delete a schedule |

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `SKIP_CRON` | `0` | Disable the cron loop (tests) |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/schedule_manager/api/v1/schedules?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
// generic proxy
await client.proxy('schedule_manager', { method: 'POST', path: '/api/v1/schedules', projectId: PID, body: { name: 'demo' } });
```

**CLI**

```bash
aerekos call schedule_manager POST "/api/v1/schedules" --project $PID --data '{"name":"demo"}'
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._
