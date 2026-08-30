# Agent prompt — host_manager

Host inventory synced from conductor /api/workers (not a second fleet to register by hand).

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/host_manager{path}`

## Endpoints

- `POST /api/v1/hosts` — Create a host ({ project_id, name, ... })
- `GET /api/v1/hosts` — List hosts (?project_id=)
- `GET /api/v1/hosts/:id` — Get one host
- `PATCH /api/v1/hosts/:id` — Update a host
- `DELETE /api/v1/hosts/:id` — Delete a host
- `POST /api/v1/sync` — Sync hosts from conductor workers

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
