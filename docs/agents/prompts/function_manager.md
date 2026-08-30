# Agent prompt — function_manager

Functions.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/function_manager{path}`

## Endpoints

- `POST /api/v1/functions` — Create a function ({ project_id, name, ... })
- `GET /api/v1/functions` — List functions (?project_id=)
- `GET /api/v1/functions/:id` — Get one function
- `PATCH /api/v1/functions/:id` — Update a function
- `DELETE /api/v1/functions/:id` — Delete a function

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
