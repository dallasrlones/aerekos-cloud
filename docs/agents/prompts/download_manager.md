# Agent prompt — download_manager

Download lists.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/download_manager{path}`

## Endpoints

- `POST /api/v1/lists` — Create a list ({ project_id, name, ... })
- `GET /api/v1/lists` — List lists (?project_id=)
- `GET /api/v1/lists/:id` — Get one list
- `PATCH /api/v1/lists/:id` — Update a list
- `DELETE /api/v1/lists/:id` — Delete a list

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
