# Agent prompt — websocket_manager

WebSocket channels.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/websocket_manager{path}`

## Endpoints

- `POST /api/v1/channels` — Create a channel ({ project_id, name, ... })
- `GET /api/v1/channels` — List channels (?project_id=)
- `GET /api/v1/channels/:id` — Get one channel
- `PATCH /api/v1/channels/:id` — Update a channel
- `DELETE /api/v1/channels/:id` — Delete a channel

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
