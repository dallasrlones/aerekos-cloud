# Agent prompt — secrets_manager

Encrypted secrets (AES-256-GCM envelope via key_manager). List never returns plaintext; ?reveal=1 for value.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/secrets_manager{path}`

## Endpoints

- `POST /api/v1/secrets` — Create a secret ({ name, value })
- `GET /api/v1/secrets` — List secrets (no values)
- `GET /api/v1/secrets/:id` — Get a secret (?reveal=1 for value)
- `PATCH /api/v1/secrets/:id` — Update a secret
- `DELETE /api/v1/secrets/:id` — Delete a secret

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
