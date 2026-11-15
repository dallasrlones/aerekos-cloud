# Agent prompt — schedule_manager

Cron schedules that dispatch to a webhook or a queue. Run-now supported. No production mocks (`SKIP_CRON` / mocked axios are test-only). **Tutorial:** none (ManagerConsole generic only — no dedicated ServiceGuide).

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/schedule_manager{path}`

Direct local: `http://localhost:3102` · **Port collision:** same `3102` as `key_manager` in `managerServicePorts.js` — cannot co-host both unbound; do not silently change `key_manager`. OpenAPI: `worker/schedule_manager/api/openapi.yaml`

## Endpoints

- `GET /health` — liveness (no projectId via conductor `isLiveness`)
- `GET /ready` — readiness / SQLite (isLiveness)
- `GET /api/v1/info` — Service metadata (`status: active`)
- `POST /api/v1/schedules` — Create a schedule (cron + target)
- `GET /api/v1/schedules` — List schedules
- `GET /api/v1/schedules/:id` — Get a schedule
- `POST /api/v1/schedules/:id/run` — Run now
- `PATCH /api/v1/schedules/:id` — Update a schedule
- `DELETE /api/v1/schedules/:id` — Delete a schedule

Capabilities: `cron`, `scheduling`, `dispatch`.

SDK/CLI: generic proxy / `aerekos call` (no dedicated `client.schedule` or `aerekos schedule` yet).

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
