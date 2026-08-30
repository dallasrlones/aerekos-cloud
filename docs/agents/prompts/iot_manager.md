# Agent prompt — iot_manager

IoT things.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/iot_manager{path}`

## Endpoints

- `POST /api/v1/things` — Create a thing ({ project_id, name, ... })
- `GET /api/v1/things` — List things (?project_id=)
- `GET /api/v1/things/:id` — Get one thing
- `PATCH /api/v1/things/:id` — Update a thing
- `DELETE /api/v1/things/:id` — Delete a thing

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
