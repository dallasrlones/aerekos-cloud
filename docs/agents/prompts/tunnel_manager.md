# Agent prompt — tunnel_manager

Create/delete Cloudflare tunnels (cloudflared) from the edge to private origins, plus ingress merge/set and adopt/import/reconcile. Token returned once on create (never stored). Pairs with `domain_manager` for DNS/hostnames. No production skip-fakes (`assertNoSkipFakes` on boot; `SKIP_CLOUDFLARE` refused in production). **Tutorial:** none standalone; console EdgeManager / ManagerConsole (no CONSOLE_GUIDES entry).

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/tunnel_manager{path}`

**Port:** `3110` · **OpenAPI:** `worker/tunnel_manager/api/openapi.yaml` (pack: `docs/openapi/tunnel_manager.yaml`)

Provider note: `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`. `SKIP_CLOUDFLARE=1` for tests/dev only.

## Endpoints

- `GET /health` / `GET /ready` — liveness / readiness (SQLite)
- `GET /api/v1/info` — metadata
- `POST /api/v1/tunnels` — Create a tunnel (token once)
- `GET /api/v1/tunnels` — List tunnels
- `GET /api/v1/tunnels/:id` — Get a tunnel
- `DELETE /api/v1/tunnels/:id` — Delete a tunnel
- `GET`/`PATCH`/`PUT /api/v1/tunnels/:id/ingress` — Ingress read / merge / replace
- `POST /api/v1/tunnels/adopt-known` — Adopt known CF tunnel ids
- `POST /api/v1/tunnels/import` — Import from Cloudflare
- `POST /api/v1/tunnels/reconcile` — Reconcile local vs CF

SDK: `client.proxy('tunnel_manager', …)`. CLI: `aerekos call tunnel_manager …`.

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
