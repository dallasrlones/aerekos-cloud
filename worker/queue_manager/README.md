# Queue Manager

Project-scoped message queues (SQS-like): create/list/get/patch/delete queues; send, receive (visibility timeout), delete (ack), change visibility. Default store is **SQLite** via `aerekos-record`. Optional engines: **fifo** (SQLite + group ordering), **rabbitmq** (AMQP), **redis_stream** (XADD/XREADGROUP).

## Status / honesty

| Claim | Reality |
|-------|---------|
| Engines | `standard` / `fifo` persist in SQLite. `rabbitmq` / `redis_stream` need live brokers (`RABBITMQ_URL` / `REDIS_URL`); tests set `SKIP_BROKER=1`. |
| Delivery | **At-least-once.** Receive locks with visibility timeout (queue default **30s**, max **12h**). Un-acked messages become visible again after timeout. |
| DLQ | Optional `dlq` + `max_receive` (default 3) on create/patch; after max receives, message is moved to the DLQ name (caller must create that queue too for SQLite engines). |
| `capacity-wait` | **Not** created by this service. Conductor SystemHome may 404 probing it — parked as UI/product noise, not a queue_manager seed. |
| Prod mocks | Default path is real SQLite. `AEREKOS_QUEUE_PROVIDER=local_nats` is an **in-memory stub** for appliance/dev only — do not use in production. |
| Tutorial | **Console ServiceGuide** on `QueueManager` screen. No standalone `docs/tutorials/queue_manager` — explicit none beyond ServiceGuide. |

Port **3101**. Proxy: `{VERB} {CONDUCTOR}/api/services/queue_manager{path}` (JWT or service token).

## Quick start

```bash
cd worker/queue_manager
cp .env_example .env
npm install
npm run dev
# curl http://localhost:3101/health
```

## Environment

See [`.env_example`](.env_example). Notable:

| Variable | Default | Notes |
|----------|---------|-------|
| `DATABASE_PATH` | `data/queue_manager.db` | SQLite file |
| `AEREKOS_QUEUE_PROVIDER` | `sqlite` | `local_nats` = in-memory stub (non-prod); `nats` = 501 until JetStream adapter |
| `SKIP_BROKER` | unset | `1` skips rabbitmq/redis I/O (tests) |
| `CONDUCTOR_URL` | unset | Optional auto-registration |

## API

Scoped by `project_id` (query, JSON body, or `X-Project-Id`).

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Liveness |
| GET | /ready | Readiness (SQLite) |
| GET | /api/v1/info | Service metadata |
| POST | /api/v1/queues | Create `{ name, project_id, engine?, visibility_timeout_seconds?, dlq?, max_receive? }` |
| GET | /api/v1/queues?project_id= | List (includes `engine`, `dlq`, `depth`, `arn` when project_id is UUID) |
| GET | /api/v1/queues/:name | Get one |
| PATCH | /api/v1/queues/:name | Update visibility / dlq / max_receive (rename not allowed) |
| DELETE | /api/v1/queues/:name | Delete queue + messages |
| POST | /api/v1/queues/:name/messages | Send `{ body, group_id?, dedup_id? }` |
| POST | /api/v1/queues/:name/messages/receive | Receive (not GET) |
| DELETE | /api/v1/queues/:name/messages/:messageId | Ack / delete |
| POST | /api/v1/queues/:name/messages/:messageId/visibility | Change visibility |

Queue name: 1–80 chars `[a-zA-Z0-9_-]`. Body max **256 KiB**. OpenAPI paths: `docs/openapi/ga-managers.generated.yaml` (from `docs/catalog.js`).

## SDK / CLI

No dedicated `client.queues` SDK surface yet — use generic proxy / `aerekos call`:

```js
await client.proxy('queue_manager', {
  method: 'POST',
  path: '/api/v1/queues',
  projectId: PID,
  body: { name: 'demo', engine: 'standard' },
});
```

```bash
aerekos call queue_manager POST "/api/v1/queues" --project $PID --data '{"name":"demo"}'
```

## Testing

| Layer | Command |
|-------|---------|
| All | `npm test` |
| Unit | `npm run test:unit` |
| Integration | `npm run test:integration` |
| E2E (in-process) | `npm run test:e2e` |

Live conductor/proxy scenarios: [`tests/e2e/README.md`](./tests/e2e/README.md).

## Related

- Conductor seed / enable on projects
- `schedule_manager` can target queues
- Catalog: `docs/services/queue_manager.md`
