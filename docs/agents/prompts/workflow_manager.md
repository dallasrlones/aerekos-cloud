# Agent prompt — workflow_manager

Run state machines (`http`, `queue`, `wait`, `choice`, `function`). Email/SMS/Slack/push steps are skipped when outbound is disabled (queued / `outbound_disabled`). Not full AWS Step Functions ASL.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/workflow_manager{path}`

Port **3135**. OpenAPI: `worker/workflow_manager/api/openapi.yaml`. Tutorial/ServiceGuide: **none** (ManagerConsole + ResourceCrud Run).

## Endpoints

- `GET /health` — Liveness
- `GET /ready` — Readiness
- `GET /api/v1/info` — Metadata
- `POST /api/v1/ensure-defaults` — Seed `hello` machine if empty
- `POST /api/v1/machines` — Create a machine ({ project_id, name, ... })
- `GET /api/v1/machines` — List machines (?project_id=)
- `GET /api/v1/machines/:id` — Get one machine
- `PATCH /api/v1/machines/:id` — Update a machine
- `DELETE /api/v1/machines/:id` — Delete a machine
- `POST /api/v1/machines/:id/run` — Run a machine (skips email/sms/slack/push when outbound disabled)

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
