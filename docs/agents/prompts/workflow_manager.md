# Agent prompt — workflow_manager

Run state machines (http, queue, wait, choice, function). Email/SMS/Slack steps are skipped.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/workflow_manager{path}`

## Endpoints

- `POST /api/v1/machines` — Create a machine ({ project_id, name, ... })
- `GET /api/v1/machines` — List machines (?project_id=)
- `GET /api/v1/machines/:id` — Get one machine
- `PATCH /api/v1/machines/:id` — Update a machine
- `DELETE /api/v1/machines/:id` — Delete a machine
- `POST /api/v1/machines/:id/run` — Run a machine (skips email/sms/slack steps)

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
