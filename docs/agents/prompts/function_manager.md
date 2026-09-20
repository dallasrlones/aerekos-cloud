# Agent prompt — function_manager

Lambda analog. Deploy/invoke plus EventSource attach/detach. Always-on poller drains inbox queues; invoke failures nack toward DLQ.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/function_manager{path}`

## Endpoints

- `POST /api/v1/functions` — Create a function ({ project_id, name, ... })
- `GET /api/v1/functions` — List functions (?project_id=)
- `GET /api/v1/functions/:id` — Get one function
- `PATCH /api/v1/functions/:id` — Update a function
- `DELETE /api/v1/functions/:id` — Delete a function
- `POST /api/v1/functions/:id/event-sources` — Attach a queue (provision inbox+DLQ if missing)
- `GET /api/v1/functions/:id/event-sources` — List EventSource mappings
- `DELETE /api/v1/functions/:id/event-sources/:sid` — Detach a queue (does not delete it)
- `POST /api/v1/functions/:name/invoke` — Invoke a function

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
