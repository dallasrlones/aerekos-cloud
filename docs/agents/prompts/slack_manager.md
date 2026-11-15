# Agent prompt — slack_manager

Slack message rows (`channel`/`text`) with optional `send`. Live Slack webhook/API only when secrets exist; otherwise queue-only. No production skip-fakes (`assertNoSkipFakes` + `SKIP_SLACK` / `SKIP_OUTBOUND` extras on boot). **Tutorial:** none standalone; console ManagerConsole (no CONSOLE_GUIDES entry).

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/slack_manager{path}`

**Port:** `3115` · **OpenAPI:** `worker/slack_manager/api/openapi.yaml` (pack: `docs/openapi/slack_manager.yaml`)

Provider note: Queued only without Slack secrets (`needs-keys`). Do not retry live Slack post in e2e without keys.

## Endpoints

- `GET /health` / `GET /ready` — liveness / readiness (SQLite)
- `GET /api/v1/info` — metadata
- `POST /api/v1/messages` — Create a message ({ project_id, name, ... })
- `GET /api/v1/messages` — List messages (?project_id=)
- `GET /api/v1/messages/:id` — Get one message
- `PATCH`/`PUT /api/v1/messages/:id` — Update a message
- `POST /api/v1/messages/:id/send` — Attempt Slack send / stay queued
- `DELETE /api/v1/messages/:id` — Delete a message

SDK: `client.resource('slack_manager', 'messages')`. CLI: `aerekos slack_manager messages …` or `aerekos call`.

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled without secrets.
