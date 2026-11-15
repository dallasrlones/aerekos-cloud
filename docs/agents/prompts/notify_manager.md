# Agent prompt — notify_manager

Unified notify facade (email/sms/slack/push). Messages + channels CRUD; send/test via shared notifyFacade. Non-prod defaults MockProvider (`NOTIFY_USE_MOCK=1`). No production skip-fakes (`assertNoSkipFakes` + `NOTIFY_USE_MOCK` / `SKIP_OUTBOUND` extras on boot). **Tutorial:** none standalone; console ManagerConsole (no CONSOLE_GUIDES entry). Legacy email/sms/slack/push remain until Phase 2.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/notify_manager{path}`

**Port:** `3154` · **OpenAPI:** `worker/notify_manager/api/openapi.yaml` (pack: `docs/openapi/notify_manager.yaml`)

Provider note: Mock/queue-only without channel secrets (`needs-keys`). Do not retry live send in e2e without keys. Live conductor e2e parked.

## Endpoints

- `GET /health` / `GET /ready` — liveness / readiness (SQLite)
- `GET /api/v1/info` — metadata (`mock` flag)
- `POST /api/v1/ensure-defaults` — seed default message
- `GET /api/v1/providers` — channel provider descriptors
- `POST /api/v1/test` — facade test send
- `POST /api/v1/messages` — Create a message ({ project_id, name, ... })
- `GET /api/v1/messages` — List messages (?project_id=)
- `GET /api/v1/messages/:id` — Get one message
- `PATCH`/`PUT /api/v1/messages/:id` — Update a message
- `POST /api/v1/messages/:id/send` — Send via facade / stay queued
- `DELETE /api/v1/messages/:id` — Delete a message
- `/api/v1/channels` — Channel config CRUD

SDK: `client.resource('notify_manager', 'messages')`. CLI: `aerekos notify_manager messages …` or `aerekos call`.

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled without secrets / under mock.
