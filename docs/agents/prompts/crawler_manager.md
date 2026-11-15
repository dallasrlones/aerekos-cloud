# Agent prompt — crawler_manager

Crawl job metadata (`start_url`/`max_depth`/`state`) with optional single-URL `run` and canary probe. Not a full Glue crawler. No production skip-fakes (`assertNoSkipFakes` + `SKIP_CRAWL` extra on boot). **Tutorial:** none standalone; console ManagerConsole (no CONSOLE_GUIDES entry).

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/crawler_manager{path}`

**Port:** `3121` · **OpenAPI:** `worker/crawler_manager/api/openapi.yaml` (pack: `docs/openapi/crawler_manager.yaml`)

Provider note: Network egress required for live fetch (`needs-keys`).

## Endpoints

- `GET /health` / `GET /ready` — liveness / readiness (SQLite)
- `GET /api/v1/info` — metadata
- `POST /api/v1/jobs/canary` — One-shot URL canary (`{ url }`)
- `POST /api/v1/jobs` — Create a job ({ project_id, name, ... })
- `GET /api/v1/jobs` — List jobs (?project_id=)
- `GET /api/v1/jobs/:id` — Get one job
- `PATCH`/`PUT /api/v1/jobs/:id` — Update a job
- `POST /api/v1/jobs/:id/run` — Fetch `start_url` once / store `result_summary`
- `DELETE /api/v1/jobs/:id` — Delete a job

SDK: `client.resource('crawler_manager', 'jobs')`. CLI: `aerekos crawler_manager jobs …` or `aerekos call`.

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
