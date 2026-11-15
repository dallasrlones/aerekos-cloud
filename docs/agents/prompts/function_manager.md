# Agent prompt — function_manager

Lambda analog. Deploy/invoke plus EventSource attach/detach. Always-on poller drains inbox queues; invoke failures nack toward DLQ. No production mocks (`assertNoSkipFakes` via `createManagerApp`). **Tutorial:** none standalone; console FunctionManager ServiceGuide.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/function_manager{path}`

**Port:** `3139` · **OpenAPI:** `worker/function_manager/api/openapi.yaml` (pack: `docs/openapi/function_manager.yaml`)

## Endpoints

- `GET /health` / `GET /ready` — liveness / readiness (SQLite)
- `GET /api/v1/info` — metadata
- `POST /api/v1/ensure-defaults` — seed `hello` if missing
- `POST /api/v1/functions` — Create a function ({ project_id, name, ... })
- `GET /api/v1/functions` — List functions (?project_id=)
- `GET /api/v1/functions/:id` — Get one function
- `PATCH /api/v1/functions/:id` — Update a function
- `DELETE /api/v1/functions/:id` — Delete a function
- `POST /api/v1/functions/:id/event-sources` — Attach a queue (provision inbox+DLQ if missing)
- `GET /api/v1/functions/:id/event-sources` — List EventSource mappings
- `DELETE /api/v1/functions/:id/event-sources/:sid` — Detach a queue (does not delete it)
- `POST /api/v1/functions/:name/invoke` — Invoke a function
- `POST /api/v1/poll` — one poll cycle

SDK: `client.functions.deploy|invoke|attachQueue|detachQueue`. CLI: `aerekos function_manager functions …` or `aerekos call`.

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
