# Queue Manager

SQS-like **project-scoped** message queues: create/list/delete queues, send, receive (with **visibility timeout**), delete, and change visibility. Persistence is **SQLite** via `aerekos-record` (per-worker, local `data/` by default).

## Status

**MVP** — core API + tests. Dead-letter queues and worker SDK are future work. See [`plan.md`](./plan.md).

## Quick start (local)

```bash
cd worker/queue_manager
cp .env_example .env
npm install
npm run dev
# curl http://localhost:3101/health
```

## Environment

See [`.env_example`](.env_example). `DATABASE_PATH` defaults to `data/queue_manager.db`. Set `CONDUCTOR_URL` for auto-registration with the conductor (optional).

## API

All resources are scoped by **`project_id`** (query, JSON body, or `X-Project-Id` header).

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Liveness |
| GET | /ready | Readiness (checks SQLite) |
| GET | /api/v1/info | Service metadata |
| POST | /api/v1/queues | Create queue: `{ "name", "project_id", "visibility_timeout_seconds?" }` |
| GET | /api/v1/queues?project_id= | List queues |
| GET | /api/v1/queues/:name?project_id= | Get one queue |
| DELETE | /api/v1/queues/:name?project_id= | Delete queue (and all messages) |
| POST | /api/v1/queues/:name/messages | Send: `{ "project_id", "body" }` (string or JSON-serialized) |
| POST | /api/v1/queues/:name/messages/receive | Receive: `{ "project_id", "max_number_of_messages?", "visibility_timeout_seconds?" }` |
| DELETE | /api/v1/queues/:name/messages/:messageId?project_id= | Delete (ack) message |
| POST | /api/v1/queues/:name/messages/:messageId/visibility | Change visibility: `{ "project_id", "visibility_timeout_seconds" }` |

Queue name: 1–80 chars `[a-zA-Z0-9_-]`. Message body max **256 KiB** (configurable in code). Default visibility on receive comes from the queue; override per call.

**Receive** uses in-memory filter/sort of visible messages; fine for typical depths—swap for indexed SQL later if needed.

## Docker

Build context is the parent `worker/` directory:

```bash
docker compose -f docker-compose.yml up --build
```

## Testing

| Layer | Command | Notes |
|-------|---------|-------|
| All | `npm test` | Integration covers queue flow |
| Unit | `npm run test:unit` | |
| Integration | `npm run test:integration` | |
| E2E | `tests/e2e/README.md` | Manual + optional CI |

## Related services

- **Conductor** — register service `queue_manager` (see conductor seed) to enable on projects
- **Worker** — runs the container; **`schedule_manager`** can enqueue to this service in future

See root [`plan.md`](../../plan.md) for the full platform map.
