# Agent prompt — graphql_manager

GraphQL APIs compiled from Data API models. POST /execute runs queries against those models.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/graphql_manager{path}`

## Endpoints

- `POST /api/v1/apis` — Create a api ({ project_id, name, ... })
- `GET /api/v1/apis` — List apis (?project_id=)
- `GET /api/v1/apis/:id` — Get one api
- `PATCH /api/v1/apis/:id` — Update a api
- `DELETE /api/v1/apis/:id` — Delete a api
- `POST /api/v1/compile` — Compile schema from Data API models
- `POST /api/v1/execute` — Execute a GraphQL query/mutation against Data API

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
