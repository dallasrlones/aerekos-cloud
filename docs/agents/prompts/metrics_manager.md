# Agent prompt — metrics_manager

Stored metric series samples (name/value/labels) plus alarm rules that can publish into `event_manager` on evaluate. Aggregation cluster / federation is future work. No production skip-fakes (`assertNoSkipFakes`). **Tutorial / ServiceGuide:** none.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/metrics_manager{path}`

**Port:** `3105` · **OpenAPI:** `worker/metrics_manager/api/openapi.yaml` (pack: `docs/openapi/metrics_manager.yaml`)

## Endpoints

- `GET /health` / `GET /ready` — liveness / readiness (SQLite)
- `GET /api/v1/info` — metadata
- `POST /api/v1/series` — Create a series sample (`project_id`, `name`, optional `metric_name`/`value`/`labels`)
- `POST /api/v1/series/sample` — Upsert sample by name
- `POST /api/v1/series/scrape` — Record scrape sample
- `GET /api/v1/series` — List (metric_name, task_id, limit)
- `GET /api/v1/series/:id` — Get one
- `PATCH /api/v1/series/:id` — Update
- `DELETE /api/v1/series/:id` — Delete
- `POST /api/v1/alarms` — Create alarm rule
- `GET /api/v1/alarms` — List alarms
- `GET|PATCH|DELETE /api/v1/alarms/:id` — CRUD one alarm
- `POST /api/v1/alarms/evaluate` — Evaluate vs value; `SKIP_OUTBOUND` parks publish

SDK: `client.resource('metrics_manager', 'series')` / `client.proxy('metrics_manager', …)`. CLI: `aerekos call metrics_manager …`.

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
