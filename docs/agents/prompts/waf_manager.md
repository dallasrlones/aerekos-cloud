# Agent prompt — waf_manager

WAF rules.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/waf_manager{path}`

## Endpoints

- `POST /api/v1/rules` — Create a rule ({ project_id, name, ... })
- `GET /api/v1/rules` — List rules (?project_id=)
- `GET /api/v1/rules/:id` — Get one rule
- `PATCH /api/v1/rules/:id` — Update a rule
- `DELETE /api/v1/rules/:id` — Delete a rule

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
