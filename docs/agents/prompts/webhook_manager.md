# Agent prompt — webhook_manager

Outbound webhooks: endpoints with secret + headers, and a dispatch action. SKIP_OUTBOUND=1 to avoid network.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/webhook_manager{path}`

## Endpoints

- `POST /api/v1/webhooks` — Create an endpoint ({ name, target_url })
- `GET /api/v1/webhooks` — List endpoints
- `GET /api/v1/webhooks/:id` — Get an endpoint
- `PATCH /api/v1/webhooks/:id` — Update an endpoint
- `DELETE /api/v1/webhooks/:id` — Delete an endpoint
- `POST /api/v1/webhooks/:id/dispatch` — Send a payload to the endpoint

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
