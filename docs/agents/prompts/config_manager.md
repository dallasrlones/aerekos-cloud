# Agent prompt — config_manager

Config namespaces plus `/evaluate` against stored flags. No production mocks (`assertNoSkipFakes` via `createManagerApp`). **Tutorial:** none (no ServiceGuide for this manager).

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/config_manager{path}`

Direct local: `http://localhost:3136` · OpenAPI: `worker/config_manager/api/openapi.yaml`

## Endpoints

- `GET /health` — Liveness (SQLite)
- `GET /ready` — Readiness
- `GET /metrics` — Prometheus text
- `GET /api/v1/info` — Service metadata (`status: active`)
- `POST /api/v1/ensure-defaults` — Seed default `app` / `{ example: false }` if empty
- `POST /api/v1/namespaces` — Create a namespace ({ project_id, name, optional flags JSON string })
- `GET /api/v1/namespaces` — List namespaces (?project_id=)
- `GET /api/v1/namespaces/:id` — Get one namespace
- `PATCH /api/v1/namespaces/:id` — Update a namespace
- `DELETE /api/v1/namespaces/:id` — Delete a namespace
- `POST /api/v1/evaluate` — `{ project_id, namespace?, flag? }` → `{ namespace, flag, value }` (missing → `false`)

Capabilities: `config`, `flags`.

SDK: `client.config.get` / `client.config.evaluate` · CLI: `aerekos config_manager namespaces …` (evaluate via SDK/curl).

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
