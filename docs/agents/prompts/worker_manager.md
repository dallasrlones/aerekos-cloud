# Agent prompt — worker_manager

Worker/fleet annotation records (`name`/`worker_id`/`key`/`value`) plus optional sync from conductor `/api/workers`. Not live AWS SSM; not the worker agent lifecycle. No production skip-fakes (`assertNoSkipFakes` on boot). **Tutorial:** none standalone; console ManagerConsole (no CONSOLE_GUIDES entry). Live conductor e2e parked.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/worker_manager{path}`

**Port:** `3128` · **OpenAPI:** `worker/worker_manager/api/openapi.yaml` (pack: `docs/openapi/worker_manager.yaml`)

Live sync needs conductor `/api/workers`.

## Endpoints

- `GET /health` / `GET /ready` — liveness / readiness (SQLite)
- `GET /api/v1/info` — metadata
- `POST /api/v1/sync` — Upsert annotations from conductor workers (`{ project_id }`)
- `POST /api/v1/annotations` — Create an annotation ({ project_id, name, ... })
- `GET /api/v1/annotations` — List annotations (?project_id=)
- `GET /api/v1/annotations/:id` — Get one annotation
- `PATCH`/`PUT /api/v1/annotations/:id` — Update an annotation
- `DELETE /api/v1/annotations/:id` — Delete an annotation

SDK: `client.resource('worker_manager', 'annotations')`. CLI: `aerekos worker_manager annotations …` or `aerekos call`.

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
