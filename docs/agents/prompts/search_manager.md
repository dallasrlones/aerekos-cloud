# Agent prompt — search_manager

Search index records (name/engine/prefix). `ensure-defaults` seeds `docs`. `POST /api/v1/index` ingests into SQLite FTS5; `POST /api/v1/query` returns real hits (`empty` only when the index has no docs). No production skip-fakes (`assertNoSkipFakes` via index + `createManagerApp`). **Tutorial:** none standalone; generic ManagerConsole. Not a full OpenSearch cluster — local FTS5 only. Live conductor e2e parked.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/search_manager{path}`

**Port:** `3144` · **OpenAPI:** `worker/search_manager/api/openapi.yaml` (pack: `docs/openapi/search_manager.yaml`)

## Endpoints

- `GET /health` / `GET /ready` — liveness / readiness (SQLite)
- `GET /api/v1/info` — metadata
- `POST /api/v1/ensure-defaults` — seed default docs index
- `POST /api/v1/index` — Index documents into FTS5
- `POST /api/v1/query` — FTS query → { hits }
- `POST /api/v1/indexes` — Create an index ({ project_id, name, ... })
- `GET /api/v1/indexes` — List indexes (?project_id=)
- `GET /api/v1/indexes/:id` — Get one index
- `PATCH`/`PUT /api/v1/indexes/:id` — Update an index
- `DELETE /api/v1/indexes/:id` — Delete an index

SDK: `client.resource('search_manager', 'indexes')`. CLI: `aerekos search_manager indexes …` or `aerekos call`.

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
