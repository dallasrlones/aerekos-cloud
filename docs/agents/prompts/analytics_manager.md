# Agent prompt — analytics_manager

Product analytics events (`event` / `value` / `properties`) plus query-on-storage (SQLite over loaded rows; Pinpoint / Kinesis Analytics naming analog only).

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/analytics_manager{path}`

## Endpoints

- `GET /health` — Liveness
- `GET /ready` — Readiness
- `GET /api/v1/info` — Service metadata
- `POST /api/v1/events` — Create an event ({ project_id, name, ... })
- `GET /api/v1/events` — List events (?project_id=)
- `GET /api/v1/events/:id` — Get one event
- `PATCH /api/v1/events/:id` — Update an event
- `DELETE /api/v1/events/:id` — Delete an event
- `POST /api/v1/query-on-storage` — SELECT over loaded events (SQLite engine; ATTACH/VACUUM rejected)

OpenAPI: `worker/analytics_manager/api/openapi.yaml`

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
