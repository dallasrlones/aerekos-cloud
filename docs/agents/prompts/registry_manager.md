# Agent prompt — registry_manager

Container registry discovery: per-project registry entries (no pull secrets), public config, artifacts, wanted pulls, project image picker. No production mocks (`assertNoSkipFakes` refuses `SKIP_DOCKER` in prod). **Tutorial:** none (RegistryManager IntegrationHub; no ServiceGuide).

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/registry_manager{path}`

**Port:** `3129` · **OpenAPI:** `worker/registry_manager/api/openapi.yaml` (pack: `docs/openapi/registry_manager.yaml`)

## Endpoints

- `GET /health` / `GET /ready` — liveness / readiness (SQLite)
- `GET /api/v1/info` — metadata
- `GET /api/v1/registry/config` — Public registry config (no secrets)
- `POST /api/v1/registries` — Create a registry entry
- `GET /api/v1/registries` — List entries
- `GET /api/v1/registries/:id` — Get an entry
- `PATCH /api/v1/registries/:id` — Update an entry
- `DELETE /api/v1/registries/:id` — Delete an entry
- `GET|POST /api/v1/artifacts` — Artifact list/create
- `GET|POST /api/v1/wanted` · `PATCH|DELETE /api/v1/wanted/:id` · `POST .../run-now`
- `GET /api/v1/images/project` · `POST /api/v1/images/import` · `GET /api/v1/inventory`

SDK: `client.resource('registry_manager', 'registries')` / `client.proxy`. CLI: `aerekos call` (no dedicated verb).

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
