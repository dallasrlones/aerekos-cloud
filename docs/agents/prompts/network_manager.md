# Agent prompt — network_manager

Per-project Docker bridge networks with stable names. Attach service containers for isolation. Optional Headscale mesh helpers. No production mocks (`assertNoSkipFakes` refuses `SKIP_DOCKER` in prod). **Tutorial:** none.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/network_manager{path}`

Direct local: `http://localhost:3103` · OpenAPI: `worker/network_manager/api/openapi.yaml`

## Endpoints

- `GET /health` — Liveness (SQLite)
- `GET /ready` — Readiness
- `GET /metrics` — Prometheus text
- `GET /api/v1/info` — Service metadata (`status: active`)
- `POST /api/v1/networks` — Create ({ project_id, name, driver? bridge })
- `GET /api/v1/networks` — List (?project_id=)
- `GET /api/v1/networks/:id` — Get one
- `DELETE /api/v1/networks/:id` — Delete
- `POST /api/v1/networks/ensure-default` — Ensure logical `default`
- `GET /api/v1/mesh` — Mesh status
- `POST /api/v1/mesh/preauth` — Mint preauth key (shown once)
- `POST /api/v1/mesh/preauth/:id/revoke` — Revoke (blocks tag:worker/platform unless force)

Capabilities: `networking`, `docker-networks`.

SDK: `client.resource('network_manager', 'networks')` or `client.proxy` · CLI: `aerekos call network_manager …` · Tutorial: none.

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
