# Agent prompt — crawler_manager

Crawl job metadata (start_url/max_depth/state). Real fetching needs network egress.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/crawler_manager{path}`

Provider note: Network egress + enabling real fetch to crawl.

## Endpoints

- `POST /api/v1/jobs` — Create a job ({ project_id, name, ... })
- `GET /api/v1/jobs` — List jobs (?project_id=)
- `GET /api/v1/jobs/:id` — Get one job
- `PATCH /api/v1/jobs/:id` — Update a job
- `DELETE /api/v1/jobs/:id` — Delete a job

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
