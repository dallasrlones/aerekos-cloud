# Agent prompt — tunnel_manager

Create/delete Cloudflare tunnels (cloudflared) from the edge to private origins. Token returned once on create.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/tunnel_manager{path}`

Provider note: CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID. SKIP_CLOUDFLARE=1 for tests.

## Endpoints

- `POST /api/v1/tunnels` — Create a tunnel
- `GET /api/v1/tunnels` — List tunnels
- `GET /api/v1/tunnels/:id` — Get a tunnel
- `DELETE /api/v1/tunnels/:id` — Delete a tunnel

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
