# Agent prompt — metrics_manager

Stored metric samples (name/value/labels). Aggregation cluster is future work.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/metrics_manager{path}`

## Endpoints

- `POST /api/v1/series` — Create a sery ({ project_id, name, ... })
- `GET /api/v1/series` — List series (?project_id=)
- `GET /api/v1/series/:id` — Get one sery
- `PATCH /api/v1/series/:id` — Update a sery
- `DELETE /api/v1/series/:id` — Delete a sery

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
