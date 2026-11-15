# Agent prompt — trace_manager

OTLP/HTTP ingest (`POST /v1/traces`) plus span list/query and trace metadata CRUD in SQLite. Not a full X-Ray / Jaeger / Tempo cluster. No production skip-fakes (`assertNoSkipFakes` via index + `createManagerApp`). **Tutorial / ServiceGuide:** none. Live conductor e2e parked.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/trace_manager{path}`

**Port:** `3143` · **OpenAPI:** `worker/trace_manager/api/openapi.yaml` (pack: `docs/openapi/trace_manager.yaml`)

## Endpoints

- `GET /health` / `GET /ready` — liveness / readiness (SQLite)
- `GET /api/v1/info` — metadata
- `POST /api/v1/ensure-defaults` — seed sample trace if missing
- `POST /v1/traces` — OTLP HTTP ingest
- `GET /api/v1/spans` — List stored spans
- `GET /api/v1/query` — Query spans
- `POST /api/v1/traces` — Create a trace ({ project_id, name, ... })
- `GET /api/v1/traces` — List traces (?project_id=)
- `GET /api/v1/traces/:id` — Get one trace
- `PATCH /api/v1/traces/:id` — Update a trace
- `DELETE /api/v1/traces/:id` — Delete a trace

SDK: `client.resource('trace_manager', 'traces')` / `client.proxy('trace_manager', …)`. CLI: `aerekos call trace_manager …`.

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
