# Agent prompt — vector_manager

Upsert/query via db_manager vectors or sqlite cosine (facade, not a second RAG). No production mocks (`assertNoSkipFakes` via `createManagerApp`). **Tutorial:** none (no ServiceGuide for this manager).

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/vector_manager{path}`

Direct local: `http://localhost:3152` · OpenAPI: `worker/vector_manager/api/openapi.yaml`

## Endpoints

- `GET /health` — Liveness (SQLite)
- `GET /ready` — Readiness
- `GET /metrics` — Prometheus text
- `GET /api/v1/info` — Service metadata (`status: active`)
- `POST /api/v1/ensure-defaults` — Seed default `rag` index if empty
- `POST /api/v1/indexes` — Create an index ({ project_id, name, ... })
- `GET /api/v1/indexes` — List indexes (?project_id=)
- `GET /api/v1/indexes/:id` — Get one index
- `PATCH /api/v1/indexes/:id` — Update an index
- `DELETE /api/v1/indexes/:id` — Delete an index
- `POST /api/v1/upsert` — Upsert vectors (local sqlite or db_manager)
- `POST /api/v1/query` — Query nearest neighbors

Capabilities: `vector`, `embeddings`.

SDK: `client.resource('vector_manager', 'indexes')` · upsert/query via `client.proxy` (no `client.vector`). CLI: `aerekos vector_manager indexes …`; upsert/query via `aerekos call` or curl.

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
