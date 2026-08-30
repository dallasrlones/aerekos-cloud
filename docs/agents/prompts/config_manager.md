# Agent prompt — config_manager

Config namespaces plus /evaluate against stored flags.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/config_manager{path}`

## Endpoints

- `POST /api/v1/namespaces` — Create a namespace ({ project_id, name, ... })
- `GET /api/v1/namespaces` — List namespaces (?project_id=)
- `GET /api/v1/namespaces/:id` — Get one namespace
- `PATCH /api/v1/namespaces/:id` — Update a namespace
- `DELETE /api/v1/namespaces/:id` — Delete a namespace
- `POST /api/v1/evaluate` — Evaluate flags from stored namespaces

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
