# Agent prompt — query_manager

SQL queries.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/query_manager{path}`

## Endpoints

- `POST /api/v1/queries` — Create a query ({ project_id, name, ... })
- `GET /api/v1/queries` — List queries (?project_id=)
- `GET /api/v1/queries/:id` — Get one query
- `PATCH /api/v1/queries/:id` — Update a query
- `DELETE /api/v1/queries/:id` — Delete a query

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
