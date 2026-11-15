# Agent prompt — event_manager

Event buses, rules, and put-event fan-out (EventBridge analog). `ensure-defaults` seeds `default` + `aerekos.fleet`. email/sms/slack targets always skipped (`outbound_disabled`); push skips under `SKIP_OUTBOUND`. No production skip-fakes (`assertNoSkipFakes` + `SKIP_OUTBOUND` extra on boot). **Tutorial:** none standalone; console ManagerConsole (no CONSOLE_GUIDES entry).

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/event_manager{path}`

**Port:** `3132` · **OpenAPI:** `worker/event_manager/api/openapi.yaml` (pack: `docs/openapi/event_manager.yaml`)

## Endpoints

- `GET /health` / `GET /ready` — liveness / readiness (SQLite)
- `GET /api/v1/info` — metadata
- `POST /api/v1/ensure-defaults` — seed default + aerekos.fleet buses
- `POST /api/v1/events` — Put event → 202 `{ event, deliveries }`
- `POST /api/v1/rules` — Create a rule
- `GET /api/v1/rules` — List rules (?project_id= / bus_id)
- `POST /api/v1/buses` — Create a bus ({ project_id, name, ... })
- `GET /api/v1/buses` — List buses (?project_id=)
- `GET /api/v1/buses/:id` — Get one bus
- `PATCH`/`PUT /api/v1/buses/:id` — Update a bus
- `DELETE /api/v1/buses/:id` — Delete a bus

SDK: `client.resource('event_manager', 'buses')`. CLI: `aerekos event_manager buses …` or `aerekos call`.

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
