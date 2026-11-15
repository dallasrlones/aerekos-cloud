# Agent prompt — api_manager

Gateway route metadata (method / `public_path` → `target_service` + ARN) plus hosted Data API. Does **not** terminate public TLS — conductor `GatewayService` match → proxy. **Tutorial:** none standalone; console **ApiGatewayManager** ServiceGuide.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/api_manager{path}`

**Port:** `3124` · **OpenAPI:** `worker/api_manager/api/openapi.yaml` (pack: `docs/openapi/api_manager.yaml`)

## Endpoints

- `GET /health` / `GET /ready` — liveness / readiness (SQLite)
- `GET /api/v1/info` — metadata
- `POST /api/v1/ensure-defaults` — Seed Data API defaults
- `POST /api/v1/endpoints` — Create a route ({ project_id, name, ... })
- `GET /api/v1/endpoints` — List routes (?project_id=)
- `GET /api/v1/endpoints/:id` — Get one route
- `PATCH /api/v1/endpoints/:id` — Update a route
- `DELETE /api/v1/endpoints/:id` — Delete a route
- `POST /api/v1/endpoints/seed-presets` — Upsert shared gateway presets
- `POST /api/v1/endpoints/match` — Resolve method+path → `proxy_path` + ARN
- `PATCH /api/v1/endpoints/:id/scale` — Set desired replicas metadata
- `POST /api/v1/data-apis/apply` — Apply model schema → Data API
- `*` `/api/v1/data/:app/:Model…` — Hosted Data API record CRUD

SDK: `client.dataApi.*` / `client.resource('api_manager', 'endpoints')`. CLI: `aerekos api_manager endpoints …` or `aerekos call`.

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
