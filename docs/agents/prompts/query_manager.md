# Agent prompt — query_manager

SQL query definitions (CRUD) plus `POST /api/v1/sql` against per-project better-sqlite3 (Athena naming analog — not AWS Athena / DuckDB). `ensure-defaults` seeds a `sample` query. ATTACH/VACUUM rejected. No production skip-fakes (`assertNoSkipFakes` + `SKIP_DUCKDB` extra on boot). **Tutorial:** none standalone; console ManagerConsole (no CONSOLE_GUIDES entry).

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/query_manager{path}`

**Port:** `3145` · **OpenAPI:** `worker/query_manager/api/openapi.yaml` (pack: `docs/openapi/query_manager.yaml`)

## Endpoints

- `GET /health` / `GET /ready` — liveness / readiness (SQLite)
- `GET /api/v1/info` — metadata
- `POST /api/v1/ensure-defaults` — seed sample query if missing
- `POST /api/v1/sql` — Run SQL (`project_id`, `sql`) → `{ rows, engine }`
- `POST /api/v1/queries` — Create a query ({ project_id, name, ... })
- `GET /api/v1/queries` — List queries (?project_id=)
- `GET /api/v1/queries/:id` — Get one query
- `PATCH`/`PUT /api/v1/queries/:id` — Update a query
- `DELETE /api/v1/queries/:id` — Delete a query

SDK: `client.resource('query_manager', 'queries')`. CLI: `aerekos query_manager queries …` or `aerekos call`.

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
