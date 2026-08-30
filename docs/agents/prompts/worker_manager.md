# Agent prompt — worker_manager

Worker/fleet labels synced from conductor /api/workers.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/worker_manager{path}`

## Endpoints

- `POST /api/v1/annotations` — Create a annotation ({ project_id, name, ... })
- `GET /api/v1/annotations` — List annotations (?project_id=)
- `GET /api/v1/annotations/:id` — Get one annotation
- `PATCH /api/v1/annotations/:id` — Update a annotation
- `DELETE /api/v1/annotations/:id` — Delete a annotation
- `POST /api/v1/sync` — Sync annotations from conductor workers

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
