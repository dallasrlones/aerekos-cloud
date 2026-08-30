# Agent prompt — compute_manager

Run containerized tasks (dockerode): create/list/get/stop/delete project-scoped tasks with port maps and labels.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/compute_manager{path}`

## Endpoints

- `POST /api/v1/tasks` — Create a task
- `GET /api/v1/tasks` — List tasks (?refresh=1 to reconcile)
- `GET /api/v1/tasks/:id` — Get a task
- `POST /api/v1/tasks/:id/stop` — Stop a task
- `DELETE /api/v1/tasks/:id` — Delete a task

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
