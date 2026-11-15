# Agent prompt — waf_manager

WAF rule records (`name`/`action`/`cidr`/`path`/`rate`). `ensure-defaults` seeds `default-rate`. `POST /api/v1/evaluate` is a **local** matcher (exact cidr string / path prefix) — not Cloudflare/AWS WAF. No production skip-fakes (`assertNoSkipFakes` via index + `createManagerApp`). **Tutorial:** none standalone; generic ManagerConsole. Live conductor e2e parked.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/waf_manager{path}`

**Port:** `3146` · **OpenAPI:** `worker/waf_manager/api/openapi.yaml` (pack: `docs/openapi/waf_manager.yaml`)

## Endpoints

- `GET /health` / `GET /ready` — liveness / readiness (SQLite)
- `GET /api/v1/info` — metadata
- `POST /api/v1/ensure-defaults` — seed default-rate rule
- `POST /api/v1/evaluate` — local allow/block from stored rules
- `POST /api/v1/rules` — Create a rule ({ project_id, name, ... })
- `GET /api/v1/rules` — List rules (?project_id=)
- `GET /api/v1/rules/:id` — Get one rule
- `PATCH`/`PUT /api/v1/rules/:id` — Update a rule
- `DELETE /api/v1/rules/:id` — Delete a rule

SDK: `client.resource('waf_manager', 'rules')`. CLI: `aerekos waf_manager rules …` or `aerekos call`.

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
