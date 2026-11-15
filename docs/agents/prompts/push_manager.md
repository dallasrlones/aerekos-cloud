# Agent prompt — push_manager

Push subscription rows (`name`/`endpoint`/`kind`) with optional `send`. Live FCM only when `FCM_SERVER_KEY` (+ device token) exist; otherwise queue-only. No production skip-fakes (`assertNoSkipFakes` + `SKIP_PUSH` / `SKIP_OUTBOUND` extras on boot). **Tutorial:** none standalone; console ManagerConsole (no CONSOLE_GUIDES entry).

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/push_manager{path}`

**Port:** `3153` · **OpenAPI:** `worker/push_manager/api/openapi.yaml` (pack: `docs/openapi/push_manager.yaml`)

Provider note: Queued only without FCM secrets (`needs-keys`). Do not retry live FCM send in e2e without keys. Live conductor proxy e2e parked.

## Endpoints

- `GET /health` / `GET /ready` — liveness / readiness (SQLite)
- `GET /api/v1/info` — metadata
- `POST /api/v1/ensure-defaults` — seed default subscription
- `POST /api/v1/send` — Attempt FCM send / stay queued
- `POST /api/v1/subscriptions` — Create a subscription ({ project_id, name, ... })
- `GET /api/v1/subscriptions` — List subscriptions (?project_id=)
- `GET /api/v1/subscriptions/:id` — Get one subscription
- `PATCH`/`PUT /api/v1/subscriptions/:id` — Update a subscription
- `DELETE /api/v1/subscriptions/:id` — Delete a subscription

SDK: `client.resource('push_manager', 'subscriptions')`. CLI: `aerekos push_manager subscriptions …` or `aerekos call`.

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled without secrets.
