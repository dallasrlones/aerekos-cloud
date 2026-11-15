# Agent prompt — logs_manager

Append-only log events with levels and context. Batch ingest for the worker outbox/shipper. Query by level/source/q/since/until. Compact by retention. No production skip-fakes (`assertNoSkipFakes`). **Tutorial / ServiceGuide:** ManagerConsole `CONSOLE_GUIDES.logs_manager`.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/logs_manager{path}`

**Port:** `3104` · **OpenAPI:** `worker/logs_manager/api/openapi.yaml` (pack: `docs/openapi/logs_manager.yaml`)

## Endpoints

- `GET /health` / `GET /ready` — liveness / readiness (SQLite)
- `GET /api/v1/info` — metadata
- `POST /api/v1/logs` — Append a log event (`project_id`, `level`, `message`, optional `source`/`context`)
- `POST /api/v1/logs/batch` — Batch append (outbox shipper)
- `GET /api/v1/logs` — Query logs (level, source, q, since, until, limit)
- `GET /api/v1/logs/:id` — Get a log event
- `DELETE /api/v1/logs/:id` — Delete a log event
- `POST /api/v1/logs/compact` — Drop rows older than retention days

SDK: `client.proxy('logs_manager', …)`. CLI: `aerekos call logs_manager …`.

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
