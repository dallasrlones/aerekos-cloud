# Agent prompt — app_manager

App project metadata (`repo_url` / `build_command`) plus FE scaffold for Icarus IDE. Amplify / App Runner naming analog only.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/app_manager{path}`

## Endpoints

- `GET /health` — Liveness
- `GET /ready` — Readiness
- `GET /api/v1/info` — Service metadata
- `POST /api/v1/apps` — Create an app ({ project_id, name, ... })
- `GET /api/v1/apps` — List apps (?project_id=)
- `GET /api/v1/apps/:id` — Get one app
- `PATCH /api/v1/apps/:id` — Update an app
- `DELETE /api/v1/apps/:id` — Delete an app
- `POST /api/v1/apps/scaffold` — Scaffold FE starter files (returns `{ item, files, open_in_ide }`; does not write git/IDE itself)

OpenAPI: `worker/app_manager/api/openapi.yaml`

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
