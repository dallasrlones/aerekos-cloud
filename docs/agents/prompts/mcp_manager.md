# Agent prompt — mcp_manager

MCP tool registry (description + input_schema). GET /platform-tools lists schemas for backup/iac/edge/systems/graphql/search/stack. HTTP invoke against `input_schema.endpoint`. Does **not** spawn live MCP server processes. **Tutorial:** none standalone; console ManagerConsole ServiceGuide.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/mcp_manager{path}`

**Port:** `3123` · **OpenAPI:** `worker/mcp_manager/api/openapi.yaml` (pack: `docs/openapi/mcp_manager.yaml`)

## Endpoints

- `GET /health` / `GET /ready` — liveness / readiness (SQLite)
- `GET /api/v1/info` — metadata
- `GET /api/v1/platform-tools` — Catalog input_schema for platform tools (backup, iac, edge, systems, graphql, search, stack)
- `POST /api/v1/tools` — Create a tool ({ project_id, name, ... })
- `GET /api/v1/tools` — List tools (?project_id=)
- `GET /api/v1/tools/:id` — Get one tool
- `PATCH /api/v1/tools/:id` — Update a tool
- `DELETE /api/v1/tools/:id` — Delete a tool
- `POST /api/v1/tools/:id/invoke` — Invoke a registered tool against input_schema.endpoint

SDK: `client.resource('mcp_manager', 'tools')`. CLI: `aerekos mcp_manager tools …` or `aerekos call`.

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
