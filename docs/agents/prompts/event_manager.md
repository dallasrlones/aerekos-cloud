# Agent prompt — event_manager

Event buses.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/event_manager{path}`

## Endpoints

- `POST /api/v1/buses` — Create a buse ({ project_id, name, ... })
- `GET /api/v1/buses` — List buses (?project_id=)
- `GET /api/v1/buses/:id` — Get one buse
- `PATCH /api/v1/buses/:id` — Update a buse
- `DELETE /api/v1/buses/:id` — Delete a buse

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
