# Agent prompt — slack_manager

Slack posts (channel/text). Send when Slack secrets exist; otherwise queue-only.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/slack_manager{path}`

Provider note: Queued only this pass. Do not retry live Slack post.

## Endpoints

- `POST /api/v1/messages` — Create a message ({ project_id, name, ... })
- `GET /api/v1/messages` — List messages (?project_id=)
- `GET /api/v1/messages/:id` — Get one message
- `PATCH /api/v1/messages/:id` — Update a message
- `DELETE /api/v1/messages/:id` — Delete a message

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
