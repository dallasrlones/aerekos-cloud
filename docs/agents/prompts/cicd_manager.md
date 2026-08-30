# Agent prompt — cicd_manager

Pipeline definitions (steps JSON + state). Real runners are future work.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/cicd_manager{path}`

## Endpoints

- `POST /api/v1/pipelines` — Create a pipeline ({ project_id, name, ... })
- `GET /api/v1/pipelines` — List pipelines (?project_id=)
- `GET /api/v1/pipelines/:id` — Get one pipeline
- `PATCH /api/v1/pipelines/:id` — Update a pipeline
- `DELETE /api/v1/pipelines/:id` — Delete a pipeline

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
