# Agent prompt — domain_manager

Cloudflare DNS records (CRUD per zone + project), zone list, and hostname bindings. Pairs with tunnel_manager for public hostnames. No production skip-fakes (`assertNoSkipFakes` — `SKIP_CLOUDFLARE` refused in prod). **Tutorial:** none standalone; EdgeManager / ManagerConsole (no `CONSOLE_GUIDES` entry).

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/domain_manager{path}`

**Port:** `3111` · **OpenAPI:** `worker/domain_manager/api/openapi.yaml` (pack: `docs/openapi/domain_manager.yaml`)

Provider note: `CLOUDFLARE_API_TOKEN` required for live DNS (`needs-keys`). `SKIP_CLOUDFLARE=1` for tests.

## Endpoints

- `GET /health` / `GET /ready` — liveness / readiness (SQLite)
- `GET /api/v1/info` — metadata
- `GET /api/v1/dns/zones` — list Cloudflare zones
- `POST`/`GET`/`PATCH`/`DELETE /api/v1/dns/records[/:id]` — DNS record CRUD (`project_id` + `zone_id`)
- `GET`/`POST`/`PATCH`/`DELETE /api/v1/dns/hostnames[/:id]` — hostname bindings

SDK: `client.proxy('domain_manager', …)`. CLI: `aerekos call domain_manager …`.

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
