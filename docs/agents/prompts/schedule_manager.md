# Agent prompt — schedule_manager

Cron schedules that dispatch to a webhook or a queue. Run-now supported.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/schedule_manager{path}`

## Endpoints

- `POST /api/v1/schedules` — Create a schedule (cron + target)
- `GET /api/v1/schedules` — List schedules
- `GET /api/v1/schedules/:id` — Get a schedule
- `POST /api/v1/schedules/:id/run` — Run now
- `PATCH /api/v1/schedules/:id` — Update a schedule
- `DELETE /api/v1/schedules/:id` — Delete a schedule

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
