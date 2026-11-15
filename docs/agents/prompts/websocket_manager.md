# Agent prompt — websocket_manager

Project-scoped channel CRUD, in-process WSS at `/ws`, and HTTP publish. API Gateway WebSocket naming analog only. Distinct from conductor Socket.IO. Tutorial/ServiceGuide: none.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/websocket_manager{path}`

Port **3131**. Health: `GET /health`, `GET /ready`, `GET /api/v1/info`.

## Endpoints

- `POST /api/v1/ensure-defaults` — Seed default `app` channel if empty
- `POST /api/v1/channels` — Create a channel ({ project_id, name, ... })
- `GET /api/v1/channels` — List channels (?project_id=)
- `GET /api/v1/channels/:id` — Get one channel
- `PATCH /api/v1/channels/:id` — Update a channel
- `DELETE /api/v1/channels/:id` — Delete a channel
- `POST /api/v1/publish` — Publish by channel name
- `POST /api/v1/channels/:id/publish` — Publish by channel id
- `POST /api/v1/internal/deliver` — Replica fan-out deliver
- WSS `/ws?project_id=&channel=` — Subscribe

OpenAPI: `worker/websocket_manager/api/openapi.yaml`. Tutorial/ServiceGuide: none.

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
