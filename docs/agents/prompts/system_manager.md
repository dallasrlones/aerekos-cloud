# Agent prompt — system_manager

Maintenance task specs (CRUD `/api/v1/tasks`) plus host OS/Docker check+update proxied to conductor `/api/workers/:id/host/*` (Systems Manager naming analog — not AWS SSM). Task `run` needs `spec_json.image` (compute_manager) or `spec_json.url`. No production skip-fakes (`assertNoSkipFakes` on boot, includes `SKIP_HOST_PATCH`). **Tutorial:** none standalone; console ManagerConsole (no CONSOLE_GUIDES entry).

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/system_manager{path}`

**Port:** `3127` · **OpenAPI:** `worker/system_manager/api/openapi.yaml` (pack: `docs/openapi/system_manager.yaml`)

## Endpoints

- `GET /health` / `GET /ready` — liveness / readiness (SQLite)
- `GET /api/v1/info` — metadata
- `POST /api/v1/tasks` — Create a task ({ project_id, name, ... })
- `GET /api/v1/tasks` — List tasks (?project_id=)
- `GET /api/v1/tasks/:id` — Get one task
- `PATCH`/`PUT /api/v1/tasks/:id` — Update a task
- `POST /api/v1/tasks/:id/run` — Run from spec_json (image or url)
- `DELETE /api/v1/tasks/:id` — Delete a task
- `GET`/`POST /api/v1/hosts/:workerId/check` — Host OS/Docker freshness (conductor proxy)
- `POST /api/v1/hosts/:workerId/update` — Update host OS or Docker ({ target })

SDK: `client.resource('system_manager', 'tasks')`. CLI: `aerekos system_manager tasks …` or `aerekos call`.

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
