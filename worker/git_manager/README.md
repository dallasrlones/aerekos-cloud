# git_manager

Self-hosted **Git repository hosting** for aerekos-cloud — your own AWS **CodeCommit** / GitHub.
It hosts real **bare repositories** on disk and serves full **clone / push / pull over Git Smart HTTP**
using the actual `git` binary, with a project-scoped REST control plane on top.

- **Port:** `3130`
- **AWS analog:** CodeCommit
- **Transport:** Git Smart HTTP (`git-upload-pack` / `git-receive-pack`)

## Control plane (REST)

Reachable through the conductor proxy like every manager:
`{VERB} {CONDUCTOR}/api/services/git_manager/api/v1/...` (JWT), or directly on `:3130`.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/repos` | Create a repo `{ project_id, name, description?, default_branch? }` → `git init --bare` (always private) |
| `GET` | `/api/v1/repos?project_id=` | List repos in a project |
| `GET` | `/api/v1/repos/:id` | Repo metadata + branches |
| `GET` | `/api/v1/repos/:id/branches` | Branch list (`name`, `sha`) |
| `GET` | `/api/v1/repos/:id/commits?branch=&limit=` | Recent commits |
| `GET` | `/api/v1/repos/:id/pushes` | Recorded push events |
| `PATCH`/`PUT` | `/api/v1/repos/:id` | Update `description` / `default_branch` (`visibility` is always private) |
| `DELETE` | `/api/v1/repos/:id` | Delete metadata + bare repo on disk |

Each created repo returns a `clone_path`, e.g. `/git/<project>/<name>.git`.

## Git transport (clone / push / pull)

```bash
# create a repo via the control plane, then:
git clone http://localhost:3130/git/<project>/<repo>.git
cd <repo>
echo "# hello" > README.md
git add . && git commit -m "init"
git push origin HEAD:main
```

The transport is mounted at `/git/:project/:repo.git/...` **before** the JSON body parser so the
upload-pack / receive-pack streams reach `git` untouched (gzip request bodies are handled).

## Push hooks

Every repo gets a `post-receive` hook that records each ref update as a **push event**
(`GET /api/v1/repos/:id/pushes`). This is the integration point for CI / webhooks
(e.g. fan out to `webhook_manager`).

## Configuration

| Env | Default | Purpose |
|-----|---------|---------|
| `PORT` | `3130` | Listen port |
| `GIT_REPOS_ROOT` | `./data/repos` | Where bare repos live (mounted volume in compose) |
| `GIT_AUTH_TOKEN` | _(unset)_ | If set, the transport requires Bearer/Basic auth with this token |
| `GIT_BIN` | `git` | Path to the git binary |
| `SKIP_GIT` | `0` | Metadata-only mode (tests / hosts without git) |
| `CONDUCTOR_URL` | _(unset)_ | Conductor base URL for self-registration |

## Tests

```bash
cd worker/git_manager && npm install && npm test   # CRUD + validation (SKIP_GIT)
```

Real clone/push/pull is validated end-to-end by the root E2E suite (`e2e/run.js`, Tier 5) against
the running container. See [`tests/e2e/README.md`](tests/e2e/README.md).

> The container image installs `git` (see the generated `Dockerfile`). For local Jest we run in
> `SKIP_GIT` mode so the suite does not require git or a writable repo store.
