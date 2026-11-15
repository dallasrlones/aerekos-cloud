# Agent prompt — billing_manager

Usage meters. `/evaluate-quota` uses real counts and denies when over; never `{ unlimited: true }`. `ensure-defaults` seeds default meters. No production skip-fakes (`assertNoSkipFakes` via `createManagerApp`). **Tutorial:** none standalone; generic ManagerConsole.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/billing_manager{path}`

**Port:** `3138` · **OpenAPI:** `worker/billing_manager/api/openapi.yaml` (pack: `docs/openapi/billing_manager.yaml`)

## Endpoints

- `GET /health` / `GET /ready` — liveness / readiness (SQLite)
- `GET /api/v1/info` — metadata
- `POST /api/v1/ensure-defaults` — seed default meters
- `POST /api/v1/evaluate-quota` — evaluate quota (deny when over; never unlimited)
- `POST /api/v1/meters` — Create a meter ({ project_id, name, ... })
- `GET /api/v1/meters` — List meters (?project_id=)
- `GET /api/v1/meters/:id` — Get one meter
- `PATCH`/`PUT /api/v1/meters/:id` — Update a meter
- `DELETE /api/v1/meters/:id` — Delete a meter

SDK: `client.resource('billing_manager', 'meters')`. CLI: `aerekos billing_manager meters …` or `aerekos call`.

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
