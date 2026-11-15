# Agent prompt — host_manager

Host inventory records (`name`/`hostname`/`address`/`role`/`metadata`) plus optional sync from conductor `/api/workers`. Not live EC2/SSM. No production skip-fakes (`assertNoSkipFakes` on boot, includes `SKIP_HOST_PATCH`). **Tutorial:** none standalone; console ManagerConsole (no CONSOLE_GUIDES entry).

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/host_manager{path}`

**Port:** `3122` · **OpenAPI:** `worker/host_manager/api/openapi.yaml` (pack: `docs/openapi/host_manager.yaml`)

Live sync needs conductor `/api/workers`.

## Endpoints

- `GET /health` / `GET /ready` — liveness / readiness (SQLite)
- `GET /api/v1/info` — metadata
- `POST /api/v1/sync` — Upsert hosts from conductor workers (`{ project_id }`)
- `POST /api/v1/hosts` — Create a host ({ project_id, name, ... })
- `GET /api/v1/hosts` — List hosts (?project_id=)
- `GET /api/v1/hosts/:id` — Get one host
- `PATCH`/`PUT /api/v1/hosts/:id` — Update a host
- `DELETE /api/v1/hosts/:id` — Delete a host

SDK: `client.resource('host_manager', 'hosts')`. CLI: `aerekos host_manager hosts …` or `aerekos call`.

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
