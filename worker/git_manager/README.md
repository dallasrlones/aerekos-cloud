# git_manager

**AWS analog:** CodeCommit · **Port:** `3130`

Self-hosted **Git repository hosting** for aerekos-cloud. Hosts real **bare repositories** on disk and serves full **clone / push / pull over Git Smart HTTP** (`git-upload-pack` / `git-receive-pack`), with a project-scoped REST control plane (repos, pulls, issues, checks). SQLite via `aerekos-record`.

No production mocks — `assertNoSkipFakes({ extra: ['SKIP_GIT'] })` refuses `SKIP_GIT` (and shared skip/MOCK flags) when `NODE_ENV=production`. Jest uses `SKIP_GIT=1` for metadata-only CRUD.

## Status

**MVP / implemented** — repo CRUD, branches/commits/compare/commit-file, push-event hooks, pulls/issues/checks, bundle/unbundle, `/health`, `/ready`, `/api/v1/info`, `/metrics`, Smart HTTP at `/git/:project/:repo.git`.

**Tutorial:** none standalone. Console **GitManager** screen uses generic **IntegrationHub** (list/create repos) — no dedicated `CONSOLE_GUIDES` / ServiceGuide copy.

## Access

- Direct: `http://localhost:3130/...`
- Conductor proxy (REST): `{CONDUCTOR}/api/services/git_manager{path}` (JWT or service token)
- **Git transport:** use the **direct port** (`GIT_MANAGER_URL`, default `:3130`). Conductor proxy does **not** stream Smart HTTP pack bodies.

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`) |
| `POST` | `/api/v1/repos` | Create (`project_id`, `name`, …) → `git init --bare` |
| `GET` | `/api/v1/repos` | List (`?project_id=`) |
| `GET` | `/api/v1/repos/:id` | Repo metadata + branches |
| `PATCH`/`PUT` | `/api/v1/repos/:id` | Update `description` / `default_branch` |
| `DELETE` | `/api/v1/repos/:id` | Delete metadata + bare repo |
| `GET`/`POST` | `/api/v1/repos/:id/branches` | List / create branch |
| `POST` | `/api/v1/repos/:id/commit-file` | Commit path on branch (`base_sha?` → 409) |
| `POST` | `/api/v1/repos/:id/delete-file` | Delete path on branch |
| `GET` | `/api/v1/repos/:id/compare` | Unified diff `base...head` |
| `GET` | `/api/v1/repos/:id/commits` | Recent commits |
| `GET` | `/api/v1/repos/:id/pushes` | Recorded push events |
| `GET` | `/api/v1/repos/:id/tree` | Tree listing |
| `GET` | `/api/v1/repos/:id/blob` | Blob content |
| `GET`/`POST` | `/api/v1/repos/:id/bundle` / `unbundle` | Bundle export / restore |
| `GET`/`POST` | `/api/v1/pulls` | Pull requests |
| `GET`/`POST` | `/api/v1/issues` | Issues |
| `GET`/`POST` | `/api/v1/checks` | Check runs |
| `GET`/`POST` | `/git/:project/:repo.git/...` | Smart HTTP (direct port) |

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/git_manager.yaml`](../../docs/openapi/git_manager.yaml). Catalog mirror: [`docs/services/git_manager.md`](../../docs/services/git_manager.md).

## SDK / CLI

- **SDK (Node):** `client.git.proxy({…})` or `client.svc.git_manager.resource('repos')` for CRUD; also `client.resource('git_manager', 'repos')`.
- **CLI:** `aerekos git_manager repos list|get|create|update|delete --project $PID` (and `-d` JSON for create/update). Extra paths via `aerekos call` / curl.

## Configuration

| Env | Default | Purpose |
|-----|---------|---------|
| `PORT` | `3130` | Listen port |
| `GIT_REPOS_ROOT` | `./data/repos` | Bare repo store |
| `GIT_AUTH_TOKEN` | _(unset)_ | If set, transport requires Bearer/Basic with this token |
| `GIT_BIN` | `git` | Path to git binary |
| `SKIP_GIT` | `0` | Metadata-only (tests only; refused in production) |
| `CONDUCTOR_URL` | _(unset)_ | Self-registration |

## Quick start

```bash
cd worker/git_manager
npm install   # use Node 20 (.nvmrc)
npm start
# curl http://localhost:3130/health
```

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | health/ready/info + prod SKIP_GIT guard wiring |
| Integration | `npm run test:integration` | repos CRUD, ARN, pulls, auth, branch/commit |
| All | `npm test` | unit + integration (`SKIP_GIT` in test setup) |
| E2E | [`tests/e2e/README.md`](./tests/e2e/README.md) | real clone/push/pull + conductor proxy REST |

## Related

- Conductor registration / proxy · GitManager IntegrationHub
- `cicd_manager` (push hooks / bundles) · `backup_manager` (bundle adapter) · IaC hookup
- Root [`GOLDEN_PATH.md`](../../GOLDEN_PATH.md) · [`docs/runbooks/git-vs-ide.md`](../../docs/runbooks/git-vs-ide.md)
