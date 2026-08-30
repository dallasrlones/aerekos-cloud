# Agent prompt — vpn_manager

Headscale preauth keys when HEADSCALE_URL is set; otherwise not-hooked-up.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/vpn_manager{path}`

## Endpoints

- `POST /api/v1/peers` — Create a peer ({ project_id, name, ... })
- `GET /api/v1/peers` — List peers (?project_id=)
- `GET /api/v1/peers/:id` — Get one peer
- `PATCH /api/v1/peers/:id` — Update a peer
- `DELETE /api/v1/peers/:id` — Delete a peer
- `POST /api/v1/preauth-keys` — Create a Headscale preauth key (or not-hooked-up)

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
