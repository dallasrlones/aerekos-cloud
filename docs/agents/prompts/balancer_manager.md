# Agent prompt — balancer_manager

Load-balancer target hints (addresses) with optional HTTP health probes. No cloud LB provisioning in MVP. No production mocks (`assertNoSkipFakes` refuses `SKIP_HEALTH` / `SKIP_DOCKER` in prod). **Tutorial:** none.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/balancer_manager{path}`

Direct local: `http://localhost:3109` · OpenAPI: `worker/balancer_manager/api/openapi.yaml`

## Endpoints

- `GET /health` — Liveness (SQLite)
- `GET /ready` — Readiness
- `GET /metrics` — Prometheus text
- `GET /api/v1/info` — Service metadata (`status: active`)
- `POST /api/v1/targets` — Create ({ project_id, name, address?, pool?, … })
- `GET /api/v1/targets` — List (?project_id=)
- `GET /api/v1/targets/:id` — Get one
- `PATCH` / `PUT /api/v1/targets/:id` — Update
- `DELETE /api/v1/targets/:id` — Delete
- `GET /api/v1/targets/health` — Probe all / optional `?pool=`
- `GET /api/v1/targets/:id/health` — Probe one

Capabilities: `load-balancing`, `targets`.

SDK: `client.balancer.list|create|health|remove` or `client.resource` / `client.proxy` · CLI: `aerekos call balancer_manager …` · Tutorial: none.

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
