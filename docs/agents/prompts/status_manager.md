# Agent prompt — status_manager

Status incidents.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/status_manager{path}`

## Endpoints

- `POST /api/v1/incidents` — Create a incident ({ project_id, name, ... })
- `GET /api/v1/incidents` — List incidents (?project_id=)
- `GET /api/v1/incidents/:id` — Get one incident
- `PATCH /api/v1/incidents/:id` — Update a incident
- `DELETE /api/v1/incidents/:id` — Delete a incident

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
