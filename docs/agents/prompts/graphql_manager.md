# Agent prompt — graphql_manager

GraphQL APIs compiled from Data API models. POST /execute runs a subset of queries/mutations against those models via api_manager. No production skip-fakes (`assertNoSkipFakes` via `createManagerApp`). **Tutorial:** none standalone; generic ManagerConsole.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/graphql_manager{path}`

**Port:** `3141` · **OpenAPI:** `worker/graphql_manager/api/openapi.yaml` (pack: `docs/openapi/graphql_manager.yaml`)

## Endpoints

- `GET /health` / `GET /ready` — liveness / readiness (SQLite)
- `GET /api/v1/info` — metadata
- `POST /api/v1/ensure-defaults` — seed default `app` schema
- `POST /api/v1/compile` — Compile schema from Data API models
- `POST /api/v1/execute` — Execute a GraphQL query/mutation against Data API
- `POST /api/v1/apis` — Create a api ({ project_id, name, ... })
- `GET /api/v1/apis` — List apis (?project_id=)
- `GET /api/v1/apis/:id` — Get one api
- `PATCH`/`PUT /api/v1/apis/:id` — Update a api
- `DELETE /api/v1/apis/:id` — Delete a api

SDK: `client.resource('graphql_manager', 'apis')`. CLI: `aerekos graphql_manager apis …` or `aerekos call`.

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
