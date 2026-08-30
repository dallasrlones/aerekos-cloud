# Agent prompt — mcp_manager

MCP tool registry (description + input_schema). GET /platform-tools lists schemas for backup/iac/edge/systems/graphql/search.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/mcp_manager{path}`

## Endpoints

- `POST /api/v1/tools` — Create a tool ({ project_id, name, ... })
- `GET /api/v1/tools` — List tools (?project_id=)
- `GET /api/v1/tools/:id` — Get one tool
- `PATCH /api/v1/tools/:id` — Update a tool
- `DELETE /api/v1/tools/:id` — Delete a tool
- `GET /api/v1/platform-tools` — Catalog input_schema for platform tools (backup, iac, edge, systems, graphql, search)
- `POST /api/v1/tools/:id/invoke` — Invoke a registered tool against input_schema.endpoint

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
