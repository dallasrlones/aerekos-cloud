# Agent prompt — email_manager

Email message rows (`to`/`subject`/`body`) with optional `send`. Live SMTP only when secrets exist; otherwise queue-only. No production skip-fakes (`assertNoSkipFakes` + `SKIP_SMTP` / `SKIP_OUTBOUND` extras on boot). **Tutorial:** none standalone; console ManagerConsole (no CONSOLE_GUIDES entry).

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/email_manager{path}`

**Port:** `3113` · **OpenAPI:** `worker/email_manager/api/openapi.yaml` (pack: `docs/openapi/email_manager.yaml`)

Provider note: Queued only without SMTP secrets (`needs-keys`). Do not retry live SMTP send in e2e without keys.

## Endpoints

- `GET /health` / `GET /ready` — liveness / readiness (SQLite)
- `GET /api/v1/info` — metadata
- `POST /api/v1/messages` — Create a message ({ project_id, name, ... })
- `GET /api/v1/messages` — List messages (?project_id=)
- `GET /api/v1/messages/:id` — Get one message
- `PATCH`/`PUT /api/v1/messages/:id` — Update a message
- `POST /api/v1/messages/:id/send` — Attempt SMTP send / stay queued
- `DELETE /api/v1/messages/:id` — Delete a message

SDK: `client.resource('email_manager', 'messages')`. CLI: `aerekos email_manager messages …` or `aerekos call`.

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled without secrets.
