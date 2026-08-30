# Agent prompt — api_manager

Gateway route definitions (method/public_path/backend_url).

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/api_manager{path}`

## Endpoints

- `POST /api/v1/endpoints` — Create a endpoint ({ project_id, name, ... })
- `GET /api/v1/endpoints` — List endpoints (?project_id=)
- `GET /api/v1/endpoints/:id` — Get one endpoint
- `PATCH /api/v1/endpoints/:id` — Update a endpoint
- `DELETE /api/v1/endpoints/:id` — Delete a endpoint

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
