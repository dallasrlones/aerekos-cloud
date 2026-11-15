# Agent prompt — code_as_infra

CloudFormation analog. Project-scoped IaC **module / snippet** CRUD (`kind` + `content`). MVP is storage only — **no apply/plan engine**. Catalog maturity: experimental. **Tutorial / ServiceGuide:** none. No production mocks.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/code_as_infra{path}`

**Port:** `3120` · **OpenAPI:** `worker/code_as_infra/api/openapi.yaml` (pack: `docs/openapi/code_as_infra.yaml`)

## Endpoints

- `GET /health` / `GET /ready` — liveness / readiness (SQLite)
- `GET /api/v1/info` — metadata (`aws: CloudFormation`)
- `POST /api/v1/modules` — Create a module ({ project_id, name, ... })
- `GET /api/v1/modules` — List modules (?project_id=)
- `GET /api/v1/modules/:id` — Get one module
- `PATCH /api/v1/modules/:id` — Update a module
- `DELETE /api/v1/modules/:id` — Delete a module

SDK: `client.resource('code_as_infra', 'modules')`. CLI: `aerekos call` / resource verbs.

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
