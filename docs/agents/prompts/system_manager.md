# Agent prompt — system_manager

Fleet patch board plus host OS/Docker check and update. Always on per device; no project enable.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/system_manager{path}`

## Endpoints

- `POST /api/v1/tasks` — Create a task ({ project_id, name, ... })
- `GET /api/v1/tasks` — List tasks (?project_id=)
- `GET /api/v1/tasks/:id` — Get one task
- `PATCH /api/v1/tasks/:id` — Update a task
- `DELETE /api/v1/tasks/:id` — Delete a task
- `GET /api/v1/hosts/:workerId/check` — Host OS/Docker freshness
- `POST /api/v1/hosts/:workerId/check` — Re-probe host OS/Docker
- `POST /api/v1/hosts/:workerId/update` — Update host OS or Docker ({ target })

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
