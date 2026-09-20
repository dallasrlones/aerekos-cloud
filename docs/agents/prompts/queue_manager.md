# Agent prompt — queue_manager

Message queues with four real engines: standard/fifo (SQLite), rabbitmq (AMQP), redis_stream (XADD/XREADGROUP). List returns engine, dlq, depth.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/queue_manager{path}`

## Endpoints

- `POST /api/v1/queues` — Create a queue
- `GET /api/v1/queues` — List queues
- `GET /api/v1/queues/:name` — Get a queue
- `DELETE /api/v1/queues/:name` — Delete a queue
- `POST /api/v1/queues/:name/messages` — Send a message
- `POST /api/v1/queues/:name/messages/receive` — Receive messages
- `DELETE /api/v1/queues/:name/messages/:messageId` — Delete (ack) a message
- `POST /api/v1/queues/:name/messages/:messageId/visibility` — Change visibility

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
