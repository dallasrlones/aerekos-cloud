# Agent prompt — code_as_infra

Infrastructure-as-code modules / snippets (kind + content).

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/code_as_infra{path}`

## Endpoints

- `POST /api/v1/modules` — Create a module ({ project_id, name, ... })
- `GET /api/v1/modules` — List modules (?project_id=)
- `GET /api/v1/modules/:id` — Get one module
- `PATCH /api/v1/modules/:id` — Update a module
- `DELETE /api/v1/modules/:id` — Delete a module

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
