# schedule_manager — EventBridge Scheduler

> **Compute** · Implemented

Cron schedules that dispatch to a webhook or a queue. Run-now supported. No production mocks (`SKIP_CRON` / mocked axios are test-only).

- **Port:** `3102` — **collides with `key_manager`** in `managerServicePorts.js` / seed; both claim host:container `3102`. Do not silently reassign `key_manager`; fleet follow-up needed before co-hosting both.
- **AWS analog:** EventBridge Scheduler
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/schedule_manager{path}` (JWT or service token)
- **Capabilities:** `cron`, `scheduling`, `dispatch`
- **OpenAPI:** [`worker/schedule_manager/api/openapi.yaml`](../../worker/schedule_manager/api/openapi.yaml) (pack copy: [`docs/openapi/schedule_manager.yaml`](../openapi/schedule_manager.yaml))
- **SDK/CLI:** generic `client.proxy('schedule_manager', …)` / `aerekos call schedule_manager …` (no dedicated schedule SDK helpers)
- **Tutorial:** none standalone. Generic **ManagerConsole** only (no dedicated Schedule Manager screen / CONSOLE_GUIDES entry).

## Health / proxy

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/health` | Liveness. Conductor proxy treats `/health` and `/ready` as **isLiveness** (no `projectId` required). |
| `GET` | `/ready` | Readiness (SQLite). |
| `GET` | `/api/v1/info` | Service metadata (`status: active`). |

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
| `PORT` | `3102` | Listen port (collides with key_manager) |
| `SKIP_CRON` | `0` | Disable the cron loop (tests) |
| `QUEUE_MANAGER_URL` | `http://127.0.0.1:3101` | Base URL for `action_type: queue` |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/schedule_manager/api/v1/schedules?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo","cron_expression":"0 * * * *","action_type":"queue","target_queue":"jobs"}'
```

**Liveness (no projectId):**

```bash
curl -s "$CONDUCTOR/api/services/schedule_manager/health"
```

**SDK (Node)**

```js
// no client.schedule.* — generic proxy only
await client.proxy('schedule_manager', {
  method: 'POST',
  path: '/api/v1/schedules',
  projectId: PID,
  body: {
    name: 'demo',
    cron_expression: '0 * * * *',
    action_type: 'queue',
    target_queue: 'jobs',
  },
});
```

**CLI**

```bash
aerekos call schedule_manager POST "/api/v1/schedules" --project $PID \
  --data '{"name":"demo","cron_expression":"0 * * * *","action_type":"queue","target_queue":"jobs"}'
```

---

_Closeout notes hand-edited; catalog regeneration may overwrite endpoint tables — keep port-collision honesty._
