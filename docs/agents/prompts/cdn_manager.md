# Agent prompt — cdn_manager

CDN-style cache rules (path pattern, origin, TTL) plus optional Cloudflare purge. CF Cache Rulesets write is parked (EDGE-PRO-4). Config + purge only in MVP — no fake `applied:true`.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/cdn_manager{path}`

OpenAPI: `worker/cdn_manager/api/openapi.yaml` · Tutorial/ServiceGuide: **none**.

## Endpoints

- `GET /health` · `GET /ready` · `GET /api/v1/info`
- `POST /api/v1/rules` — Create a rule ({ project_id, name, ... })
- `GET /api/v1/rules` — List rules (?project_id=)
- `GET /api/v1/rules/:id` — Get one rule
- `PATCH`/`PUT /api/v1/rules/:id` — Update a rule
- `DELETE /api/v1/rules/:id` — Delete a rule
- `POST /api/v1/rules/:id/probe` — Probe origin
- `POST /api/v1/purge` — Cloudflare purge (needs CLOUDFLARE_API_TOKEN + ZONE_ID)
- `POST /api/v1/cache-rules` · `POST /api/v1/waf` — parked intent (applied:false)

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
