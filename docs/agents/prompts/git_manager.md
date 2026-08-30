# Agent prompt — git_manager

Self-hosted Git hosting: bare repos + full clone/push/pull over Git Smart HTTP, plus push-event hooks.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/git_manager{path}`

## Endpoints

- `POST /api/v1/repos` — Create a repo (git init --bare)
- `GET /api/v1/repos` — List repos
- `GET /api/v1/repos/:id` — Get a repo + branches
- `GET /api/v1/repos/:id/branches` — List branches
- `GET /api/v1/repos/:id/commits` — List commits (?branch=&limit=)
- `GET /api/v1/repos/:id/pushes` — List recorded push events
- `PATCH /api/v1/repos/:id` — Update a repo
- `DELETE /api/v1/repos/:id` — Delete a repo
- `GET/POST /git/:project/:repo.git/...` — Git Smart HTTP transport (clone/push/pull, direct port)

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
