# Agent prompt — balancer_manager

Load-balancer target hints (addresses). No cloud LB provisioning in MVP.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/balancer_manager{path}`

## Endpoints

- `POST /api/v1/targets` — Create a target ({ project_id, name, ... })
- `GET /api/v1/targets` — List targets (?project_id=)
- `GET /api/v1/targets/:id` — Get one target
- `PATCH /api/v1/targets/:id` — Update a target
- `DELETE /api/v1/targets/:id` — Delete a target

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
