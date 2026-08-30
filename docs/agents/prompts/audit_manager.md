# Agent prompt — audit_manager

Audit events.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/audit_manager{path}`

## Endpoints

- `POST /api/v1/events` — Create a event ({ project_id, name, ... })
- `GET /api/v1/events` — List events (?project_id=)
- `GET /api/v1/events/:id` — Get one event
- `PATCH /api/v1/events/:id` — Update a event
- `DELETE /api/v1/events/:id` — Delete a event

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
