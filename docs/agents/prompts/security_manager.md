# Agent prompt — security_manager

Security finding records (severity/source/details). Detectors wired later.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/security_manager{path}`

## Endpoints

- `POST /api/v1/findings` — Create a finding ({ project_id, name, ... })
- `GET /api/v1/findings` — List findings (?project_id=)
- `GET /api/v1/findings/:id` — Get one finding
- `PATCH /api/v1/findings/:id` — Update a finding
- `DELETE /api/v1/findings/:id` — Delete a finding

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
