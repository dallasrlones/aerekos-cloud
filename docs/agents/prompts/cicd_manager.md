# Agent prompt — cicd_manager

Pipeline definitions (steps JSON + state) with `run` / `run-for-repo`. Deploy/build proxies to `compute_manager`; live CI runners are out of scope for MVP. No production skip-fakes (`assertNoSkipFakes` on boot). **Tutorial:** none standalone; console CicdManager screen.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/cicd_manager{path}`

**Port:** `3119` · **OpenAPI:** `worker/cicd_manager/api/openapi.yaml` (pack: `docs/openapi/cicd_manager.yaml`)

## Endpoints

- `GET /health` / `GET /ready` — liveness / readiness (SQLite)
- `GET /api/v1/info` — metadata
- `POST /api/v1/pipelines` — Create a pipeline ({ project_id, name, ... })
- `GET /api/v1/pipelines` — List pipelines (?project_id=)
- `GET /api/v1/pipelines/:id` — Get one pipeline
- `PATCH`/`PUT /api/v1/pipelines/:id` — Update a pipeline
- `DELETE /api/v1/pipelines/:id` — Delete a pipeline
- `POST /api/v1/pipelines/:id/run` — Run (test / deploy / build-image / apply-stack / fleet)
- `POST /api/v1/pipelines/run-for-repo` — Match + run for a repo push

SDK: `client.resource('cicd_manager', 'pipelines')`. CLI: `aerekos cicd_manager pipelines …` or `aerekos call`.

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
