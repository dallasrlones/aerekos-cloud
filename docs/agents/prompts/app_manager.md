# Agent prompt — app_manager

App project metadata (repo_url/build_command).

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/app_manager{path}`

## Endpoints

- `POST /api/v1/apps` — Create a app ({ project_id, name, ... })
- `GET /api/v1/apps` — List apps (?project_id=)
- `GET /api/v1/apps/:id` — Get one app
- `PATCH /api/v1/apps/:id` — Update a app
- `DELETE /api/v1/apps/:id` — Delete a app

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
