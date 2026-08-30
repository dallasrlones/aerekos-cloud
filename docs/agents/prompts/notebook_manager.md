# Agent prompt — notebook_manager

Store notebooks; Run launches a compute oneshot (jupyter/python).

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/notebook_manager{path}`

## Endpoints

- `POST /api/v1/notebooks` — Create a notebook ({ project_id, name, ... })
- `GET /api/v1/notebooks` — List notebooks (?project_id=)
- `GET /api/v1/notebooks/:id` — Get one notebook
- `PATCH /api/v1/notebooks/:id` — Update a notebook
- `DELETE /api/v1/notebooks/:id` — Delete a notebook
- `POST /api/v1/notebooks/:id/run` — Run notebook via compute oneshot

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
