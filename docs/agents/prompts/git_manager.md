# Agent prompt — git_manager

Self-hosted Git hosting: bare repos + full clone/push/pull over Git Smart HTTP, plus push-event hooks, pulls/issues/checks. No production mocks (`SKIP_GIT` refused when `NODE_ENV=production`). **Tutorial:** none (GitManager IntegrationHub only — no ServiceGuide).

Reach REST through the conductor proxy with a JWT from `POST /api/auth/login` or a service token. Use the **direct** git_manager port for Smart HTTP (proxy does not stream pack).

Base: `{VERB} {CONDUCTOR}/api/services/git_manager{path}`

Port **3130**. OpenAPI: `worker/git_manager/api/openapi.yaml` (pack: `docs/openapi/git_manager.yaml`).

## Endpoints

- `GET /health` / `GET /ready` / `GET /api/v1/info`
- `POST /api/v1/repos` — Create a repo (git init --bare)
- `GET /api/v1/repos` — List repos
- `GET /api/v1/repos/:id` — Get a repo + branches
- `GET|POST /api/v1/repos/:id/branches` — List / create branches
- `POST /api/v1/repos/:id/commit-file` — Commit a file
- `GET /api/v1/repos/:id/commits` — List commits (?branch=&limit=)
- `GET /api/v1/repos/:id/pushes` — List recorded push events
- `PATCH /api/v1/repos/:id` — Update a repo
- `DELETE /api/v1/repos/:id` — Delete a repo
- `GET|POST /api/v1/pulls|issues|checks` — PR / issue / check surfaces
- `GET/POST /git/:project/:repo.git/...` — Git Smart HTTP transport (direct port)

## SDK / CLI

- SDK: `client.svc.git_manager.resource('repos')` or `client.git.proxy({…})`
- CLI: `aerekos git_manager repos create|list|get|update|delete --project $PID`

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.
