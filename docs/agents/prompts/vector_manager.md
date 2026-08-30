# Agent prompt — vector_manager

Upsert/query via db_manager vectors or sqlite cosine (facade, not a second RAG).

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/vector_manager{path}`

## Endpoints

- `POST /api/v1/indexes` — Create a indexe ({ project_id, name, ... })
- `GET /api/v1/indexes` — List indexes (?project_id=)
- `GET /api/v1/indexes/:id` — Get one indexe
- `PATCH /api/v1/indexes/:id` — Update a indexe
- `DELETE /api/v1/indexes/:id` — Delete a indexe
- `POST /api/v1/upsert` — Upsert vectors
- `POST /api/v1/query` — Query nearest neighbors

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
