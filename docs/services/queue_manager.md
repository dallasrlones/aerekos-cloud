# queue_manager — SQS

> **Compute** · Implemented

Project-scoped queues: standard/fifo (SQLite), rabbitmq (AMQP), redis_stream. At-least-once + visibility (default 30s). Optional DLQ. Does not auto-create capacity-wait. Default store SQLite; `AEREKOS_QUEUE_PROVIDER=local_nats` is in-memory non-prod only.

- **Port:** `3101`
- **AWS analog:** SQS
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/queue_manager{path}` (JWT or service token)
- **Capabilities:** `queues`, `messaging`
- **SDK/CLI:** `client.queue.create|list|get|remove|send|receive`; CLI via `aerekos call queue_manager …` (no dedicated `aerekos queue` subcommand yet)
- **Tutorial:** console **ServiceGuide** on Queue Manager screen; no standalone tutorial doc
- **Honesty:** receive is `POST …/messages/receive` only — conductor SystemHome `GET …/capacity-wait/messages` 404s are parked UI noise; this manager does not seed `capacity-wait`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/queues` | Create a queue (engine, dlq, visibility optional) |
| `GET` | `/api/v1/queues` | List queues (engine, dlq, depth) |
| `GET` | `/api/v1/queues/:name` | Get a queue |
| `PATCH` | `/api/v1/queues/:name` | Update visibility / dlq / max_receive |
| `DELETE` | `/api/v1/queues/:name` | Delete a queue |
| `POST` | `/api/v1/queues/:name/messages` | Send a message |
| `POST` | `/api/v1/queues/:name/messages/receive` | Receive messages (POST only; no GET list) |
| `DELETE` | `/api/v1/queues/:name/messages/:messageId` | Delete (ack) a message |
| `POST` | `/api/v1/queues/:name/messages/:messageId/visibility` | Change visibility |

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `AEREKOS_QUEUE_PROVIDER` | `sqlite` | sqlite (prod default) \| local_nats (in-memory stub, non-prod) \| nats (501 until JetStream) |
| `SKIP_BROKER` | `0` | Skip rabbitmq/redis I/O (tests) |
| `RABBITMQ_URL` | `amqp://aerekos:aerekos@rabbitmq:5672` | Required for engine=rabbitmq |
| `REDIS_URL` | `redis://redis:6379` | Required for engine=redis_stream |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/queue_manager/api/v1/queues?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
await client.queue.create(PID, { name: 'demo' });
// or generic proxy:
await client.proxy('queue_manager', { method: 'POST', path: '/api/v1/queues', projectId: PID, body: { name: 'demo' } });
```

**CLI**

```bash
aerekos call queue_manager POST "/api/v1/queues" --project $PID --data '{"name":"demo"}'
```

---

_Generated from `docs/catalog.js` (hand-extended honesty for closeout). Edit the catalog and run `make docs` to refresh base fields; keep honesty notes in sync._
