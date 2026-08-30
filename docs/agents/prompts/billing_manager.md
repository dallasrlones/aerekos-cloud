# Agent prompt — billing_manager

Usage meters. /evaluate-quota uses real counts and denies when over; never { unlimited: true }.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/billing_manager{path}`

## Endpoints

- `POST /api/v1/meters` — Create a meter ({ project_id, name, ... })
- `GET /api/v1/meters` — List meters (?project_id=)
- `GET /api/v1/meters/:id` — Get one meter
- `PATCH /api/v1/meters/:id` — Update a meter
- `DELETE /api/v1/meters/:id` — Delete a meter
- `POST /api/v1/evaluate-quota` — Evaluate quota (deny when over)

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
