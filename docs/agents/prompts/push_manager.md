# Agent prompt — push_manager

Push subscriptions. Queued; outbound send disabled.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/push_manager{path}`

Provider note: Queued only this pass. Do not retry live FCM send.

## Endpoints

- `POST /api/v1/subscriptions` — Create a subscription ({ project_id, name, ... })
- `GET /api/v1/subscriptions` — List subscriptions (?project_id=)
- `GET /api/v1/subscriptions/:id` — Get one subscription
- `PATCH /api/v1/subscriptions/:id` — Update a subscription
- `DELETE /api/v1/subscriptions/:id` — Delete a subscription

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
