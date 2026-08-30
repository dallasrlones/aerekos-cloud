# Agent prompt — auth_manager

OIDC provider metadata (issuer/client_id/config). Keep client_secret in secrets_manager.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/auth_manager{path}`

Provider note: OIDC client_secret (store in secrets_manager) to complete real auth flows.

## Endpoints

- `POST /api/v1/providers` — Create a provider ({ project_id, name, ... })
- `GET /api/v1/providers` — List providers (?project_id=)
- `GET /api/v1/providers/:id` — Get one provider
- `PATCH /api/v1/providers/:id` — Update a provider
- `DELETE /api/v1/providers/:id` — Delete a provider

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
