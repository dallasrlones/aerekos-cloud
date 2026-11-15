# Agent prompt — webhook_manager

Outbound webhook endpoints (`name`/`target_url`/optional secret+headers) plus `dispatch` and delivery history. `SKIP_OUTBOUND=1` skips live HTTP (tests/dev only). Production refuses `SKIP_OUTBOUND` / skip-fakes (`assertNoSkipFakes` via index + `createManagerApp`). Not an inbound receiver. **Tutorial:** none standalone; generic ManagerConsole. Live conductor e2e parked.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/webhook_manager{path}`

**Port:** `3112` · **OpenAPI:** `worker/webhook_manager/api/openapi.yaml` (pack: `docs/openapi/webhook_manager.yaml`)

## Endpoints

- `GET /health` / `GET /ready` — liveness / readiness (SQLite)
- `GET /api/v1/info` — metadata
- `POST /api/v1/webhooks` — Create an endpoint ({ project_id, name, target_url })
- `GET /api/v1/webhooks` — List endpoints (?project_id=)
- `GET /api/v1/webhooks/:id` — Get an endpoint
- `PATCH`/`PUT /api/v1/webhooks/:id` — Update an endpoint
- `DELETE /api/v1/webhooks/:id` — Delete an endpoint
- `POST /api/v1/webhooks/:id/dispatch` — Send a payload (`mode: skip|live`)
- `GET /api/v1/webhooks/:id/deliveries` — Delivery history

SDK: `client.proxy('webhook_manager', …)`. CLI: `aerekos call`.

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
