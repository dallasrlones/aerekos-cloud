# Agent prompt — notebook_manager

Notebook records (name/image/url/status). `ensure-defaults` seeds `lab`. `POST /api/v1/notebooks/:id/run` launches a compute_manager oneshot via conductor when `CONDUCTOR_URL` is set; otherwise records `status: queued` honestly. No production skip-fakes (`assertNoSkipFakes` via `createManagerApp`). **Tutorial:** none standalone; generic ManagerConsole.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/notebook_manager{path}`

**Port:** `3142` · **OpenAPI:** `worker/notebook_manager/api/openapi.yaml` (pack: `docs/openapi/notebook_manager.yaml`)

## Endpoints

- `GET /health` / `GET /ready` — liveness / readiness (SQLite)
- `GET /api/v1/info` — metadata
- `POST /api/v1/ensure-defaults` — seed default notebook
- `POST /api/v1/notebooks` — Create a notebook ({ project_id, name, ... })
- `GET /api/v1/notebooks` — List notebooks (?project_id=)
- `GET /api/v1/notebooks/:id` — Get one notebook
- `PATCH`/`PUT /api/v1/notebooks/:id` — Update a notebook
- `DELETE /api/v1/notebooks/:id` — Delete a notebook
- `POST /api/v1/notebooks/:id/run` — Run via compute oneshot (queues without conductor)

SDK: `client.resource('notebook_manager', 'notebooks')`. CLI: `aerekos notebook_manager notebooks …` or `aerekos call`.

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
