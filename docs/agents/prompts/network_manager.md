# Agent prompt — network_manager

Per-project Docker bridge networks with stable names. Attach service containers for isolation.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/network_manager{path}`

## Endpoints

- `POST /api/v1/networks` — Create a network
- `GET /api/v1/networks` — List networks
- `GET /api/v1/networks/:id` — Get a network
- `DELETE /api/v1/networks/:id` — Delete a network

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
