# Agent prompt — status_manager

Status incidents (CRUD) plus `GET /api/v1/public` aggregate (`ok` / `degraded` from non-resolved) and `ensure-defaults` (seeds `all-clear`). Statuspage naming analog only — not Atlassian Statuspage. No production skip-fakes (`assertNoSkipFakes` + `createManagerApp` on boot). **Tutorial:** none standalone; console ManagerConsole (no CONSOLE_GUIDES entry).

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/status_manager{path}`

**Port:** `3150` · **OpenAPI:** `worker/status_manager/api/openapi.yaml` (pack: `docs/openapi/status_manager.yaml`)

## Endpoints

- `GET /health` / `GET /ready` — liveness / readiness (SQLite)
- `GET /api/v1/info` — metadata
- `POST /api/v1/ensure-defaults` — seed `all-clear` if missing
- `GET /api/v1/public` — aggregate status (`?project_id=`) → `{ status, incidents }`
- `POST /api/v1/incidents` — Create an incident ({ project_id, name, ... })
- `GET /api/v1/incidents` — List incidents (?project_id=)
- `GET /api/v1/incidents/:id` — Get one incident
- `PATCH`/`PUT /api/v1/incidents/:id` — Update an incident
- `DELETE /api/v1/incidents/:id` — Delete an incident

SDK: `client.resource('status_manager', 'incidents')`. CLI: `aerekos status_manager incidents …` or `aerekos call`.

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
