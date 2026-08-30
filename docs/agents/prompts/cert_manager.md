# Agent prompt — cert_manager

Import PEM or mint self-signed certificates. No Let's Encrypt.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/cert_manager{path}`

## Endpoints

- `POST /api/v1/certs` — Create a cert ({ project_id, name, ... })
- `GET /api/v1/certs` — List certs (?project_id=)
- `GET /api/v1/certs/:id` — Get one cert
- `PATCH /api/v1/certs/:id` — Update a cert
- `DELETE /api/v1/certs/:id` — Delete a cert
- `POST /api/v1/certs/mint` — Mint a self-signed PEM
- `POST /api/v1/certs/import` — Import a PEM bundle

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
