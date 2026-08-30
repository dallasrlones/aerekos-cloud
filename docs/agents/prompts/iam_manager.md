# Agent prompt — iam_manager

Roles, policies (allow/deny JSON documents), and role↔policy bindings. Enforcement lives in the conductor.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/iam_manager{path}`

## Endpoints

- `POST /api/v1/roles` — Create a role
- `GET /api/v1/roles` — List roles
- `GET /api/v1/roles/:id` — Get a role
- `PATCH /api/v1/roles/:id` — Update a role
- `DELETE /api/v1/roles/:id` — Delete a role
- `POST /api/v1/roles/:roleId/policies` — Attach a policy to a role
- `GET /api/v1/roles/:roleId/policies` — List a role's policies
- `DELETE /api/v1/roles/:roleId/policies/:policyId` — Detach a policy
- `POST /api/v1/policies` — Create a policy
- `GET /api/v1/policies` — List policies
- `GET /api/v1/policies/:id` — Get a policy
- `PATCH /api/v1/policies/:id` — Update a policy
- `DELETE /api/v1/policies/:id` — Delete a policy

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
