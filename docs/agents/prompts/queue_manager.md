# Agent prompt — queue_manager

Project-scoped queues: standard/fifo (SQLite), rabbitmq (AMQP), redis_stream. At-least-once delivery with visibility timeout (default 30s). Optional DLQ. Does **not** auto-create `capacity-wait`.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/queue_manager{path}`

## Endpoints

- `POST /api/v1/queues` — Create a queue (engine, dlq, visibility optional)
- `GET /api/v1/queues` — List queues (engine, dlq, depth)
- `GET /api/v1/queues/:name` — Get a queue
- `PATCH /api/v1/queues/:name` — Update visibility / dlq / max_receive
- `DELETE /api/v1/queues/:name` — Delete a queue
- `POST /api/v1/queues/:name/messages` — Send a message
- `POST /api/v1/queues/:name/messages/receive` — Receive messages (POST only)
- `DELETE /api/v1/queues/:name/messages/:messageId` — Delete (ack) a message
- `POST /api/v1/queues/:name/messages/:messageId/visibility` — Change visibility

SDK/CLI: generic proxy / `aerekos call`. Tutorial: console ServiceGuide only (no standalone tutorial).

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
Do not set `AEREKOS_QUEUE_PROVIDER=local_nats` for production paths.
