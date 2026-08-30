# Agent prompt — logs_manager

Append-only log events with levels and context. Batch ingest for the worker outbox/shipper.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/logs_manager{path}`

## Endpoints

- `POST /api/v1/logs` — Append a log event
- `POST /api/v1/logs/batch` — Batch append (outbox shipper)
- `GET /api/v1/logs` — Query logs (level, since, limit)
- `GET /api/v1/logs/:id` — Get a log event

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
