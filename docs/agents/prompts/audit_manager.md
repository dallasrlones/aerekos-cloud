# Agent prompt — audit_manager

Project-scoped audit events (CloudTrail analog). SQLite CRUD + ingest; no production mocks.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/audit_manager{path}`

## Endpoints

- `GET /health` — Liveness
- `GET /ready` — Readiness
- `GET /api/v1/info` — Metadata (`status: "active"`)
- `POST /api/v1/ensure-defaults` — Seed bootstrap event ({ project_id })
- `POST /api/v1/ingest` — Convenience writer ({ project_id, name, actor, action, detail })
- `POST /api/v1/events` — Create a event ({ project_id, name, ... })
- `GET /api/v1/events` — List events (?project_id=)
- `GET /api/v1/events/:id` — Get one event
- `PATCH /api/v1/events/:id` — Update a event
- `DELETE /api/v1/events/:id` — Delete a event

OpenAPI: `worker/audit_manager/api/openapi.yaml`. Tutorial: none — ManagerConsole / ObservabilityPanel.

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
