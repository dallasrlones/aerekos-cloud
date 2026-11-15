# Agent prompt — compute_manager

aerekos Compute: project-scoped tasks (dockerode) and Deployments (rolling update / pause / resume / rollback). Port **3100**.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/compute_manager{path}`

Health: `GET /health`, `GET /ready` (no `project_id`). Info: `GET /api/v1/info`.

OpenAPI: `worker/compute_manager/api/openapi.yaml` · pack `docs/openapi/compute_manager.yaml`.

SDK: `client.compute.list|create|scale|remove`. CLI: `aerekos call compute_manager …` (no dedicated compute verbs).

`SKIP_DOCKER=1` is for tests only — refused when `NODE_ENV=production`.

## Endpoints

- `POST /api/v1/tasks` — Create a task
- `GET /api/v1/tasks` — List tasks (?refresh=1 to reconcile)
- `GET /api/v1/tasks/:id` — Get a task
- `POST /api/v1/tasks/:id/stop` — Stop a task
- `DELETE /api/v1/tasks/:id` — Delete a task
- `PUT /api/v1/deployments/:id` — Apply Deployment
- `GET /api/v1/deployments/:id` — Get Deployment + status
- `POST /api/v1/deployments/:id/reconcile|pause|resume|rollback` — Rollout controls

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
