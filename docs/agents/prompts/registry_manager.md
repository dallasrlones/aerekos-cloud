# Agent prompt — registry_manager

Container registry discovery: per-project registry entries (no pull secrets) + a public config endpoint.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/registry_manager{path}`

## Endpoints

- `POST /api/v1/registries` — Create a registry entry
- `GET /api/v1/registries` — List entries
- `GET /api/v1/registries/:id` — Get an entry
- `PATCH /api/v1/registries/:id` — Update an entry
- `DELETE /api/v1/registries/:id` — Delete an entry
- `GET /api/v1/registry/config` — Public registry config (no secrets)

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
