# Agent prompt — trace_manager

OTLP/HTTP ingest plus span list/query in SQLite.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/trace_manager{path}`

## Endpoints

- `POST /api/v1/traces` — Create a trace ({ project_id, name, ... })
- `GET /api/v1/traces` — List traces (?project_id=)
- `GET /api/v1/traces/:id` — Get one trace
- `PATCH /api/v1/traces/:id` — Update a trace
- `DELETE /api/v1/traces/:id` — Delete a trace
- `POST /v1/traces` — OTLP HTTP ingest
- `GET /api/v1/spans` — List stored spans
- `GET /api/v1/query` — Query spans

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
