# Schedule Manager

**Cron** schedules (with timezone) that dispatch to an **HTTP webhook** or to **`queue_manager`** (SQS-like queue), similar in spirit to EventBridge + SQS. Persistence: **SQLite** + `aerekos-record` per worker.

## Status

**MVP** — CRUD schedules, `node-cron` execution, manual **run now** for tests/ops. One-shot / delayed rules are a future addition. See [`plan.md`](./plan.md).

## Quick start (local)

```bash
cd worker/schedule_manager
cp .env_example .env
npm install
npm run dev
# curl http://localhost:3102/health
```

## Environment

| Variable | Default | Meaning |
|----------|---------|---------|
| `DATABASE_PATH` | `data/schedule_manager.db` | SQLite file |
| `QUEUE_MANAGER_URL` | `http://127.0.0.1:3101` | Base URL for `action_type: queue` (overridable at dispatch time) |
| `WEBHOOK_TIMEOUT_MS` | `30000` | Outbound HTTP timeout |
| `CONDUCTOR_URL` | — | If set, registers with conductor |
| `SKIP_SERVICE_REGISTRATION` | — | `true` in tests |
| `SKIP_START_CRON` | — | `true` to avoid registering crons on server start (rare) |
| `SKIP_CRON` | — | `1` in tests: persist schedules but do not register `node-cron` jobs |

## API

`project_id` is required: query string, JSON body, or `X-Project-Id`.

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Liveness |
| GET | /ready | Readiness (SQLite) |
| GET | /api/v1/info | Service metadata |
| POST | /api/v1/schedules | Create: `name`, `project_id`, `cron_expression`, `timezone?` (default `UTC`), `action_type` (`webhook` \| `queue`), `target_url?`, `target_queue?`, `http_method?`, `message_template?`, `request_headers?` (JSON string for webhooks), `enabled?` |
| GET | /api/v1/schedules?project_id= | List |
| GET | /api/v1/schedules/:id?project_id= | Get one |
| PATCH | /api/v1/schedules/:id | Partial update (same fields as create) |
| DELETE | /api/v1/schedules/:id?project_id= | Delete and unregister cron |
| POST | /api/v1/schedules/:id/run | **Run once now** (testing / firefighting) |

**Cron** expressions follow `node-cron` (5 or 6 fields; optional seconds). **Webhook** methods: `GET`, `POST`, `HEAD` (default `POST`).

## Docker

Build context is the parent `worker/` directory:

```bash
docker compose -f docker-compose.yml up --build
```

## Testing

`npm test` — integration with mocked `axios` (no real queue or webhook required).

## Related services

- **`queue_manager`** — optional target for `action_type: queue`
- **Conductor** — enable `schedule_manager` on a project; seed includes service row on startup

See root [`plan.md`](../../plan.md) for the full platform map.
