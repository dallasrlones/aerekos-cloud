# Agent prompt — iot_manager

IoT thing records (name/topic/status). `ensure-defaults` seeds `device-1`. `POST /api/v1/publish` fans out via websocket_manager (or `{ skipped: true }` under `SKIP_OUTBOUND` in non-prod). No production skip-fakes (`assertNoSkipFakes` via `createManagerApp` + `SKIP_OUTBOUND` extra). **Tutorial:** none standalone; generic ManagerConsole.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/iot_manager{path}`

**Port:** `3140` · **OpenAPI:** `worker/iot_manager/api/openapi.yaml` (pack: `docs/openapi/iot_manager.yaml`)

## Endpoints

- `GET /health` / `GET /ready` — liveness / readiness (SQLite)
- `GET /api/v1/info` — metadata
- `POST /api/v1/ensure-defaults` — seed default thing
- `POST /api/v1/publish` — publish payload (websocket fan-out)
- `POST /api/v1/things` — Create a thing ({ project_id, name, ... })
- `GET /api/v1/things` — List things (?project_id=)
- `GET /api/v1/things/:id` — Get one thing
- `PATCH`/`PUT /api/v1/things/:id` — Update a thing
- `DELETE /api/v1/things/:id` — Delete a thing

SDK: `client.resource('iot_manager', 'things')`. CLI: `aerekos iot_manager things …` or `aerekos call`.

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
