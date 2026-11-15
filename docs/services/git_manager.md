# git_manager — CodeCommit

> **Dev tools** · Implemented

Self-hosted Git hosting: bare repos + full clone/push/pull over Git Smart HTTP, plus push-event hooks, pulls/issues/checks. No production mocks (`assertNoSkipFakes` with `SKIP_GIT` refused in production). **Tutorial:** none standalone — console **GitManager** uses IntegrationHub (no dedicated ServiceGuide / `CONSOLE_GUIDES` entry).

- **Port:** `3130`
- **AWS analog:** CodeCommit
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/git_manager{path}` (JWT or service token) for REST; Smart HTTP on the **direct** port (proxy does not stream pack)
- **Capabilities:** `git`, `scm`, `smart-http`
- **OpenAPI:** `worker/git_manager/api/openapi.yaml` (pack copy: `docs/openapi/git_manager.yaml`)
- **SDK/CLI:** `client.svc.git_manager.resource('repos')` / `client.git.proxy`; CLI `aerekos git_manager repos …` / `aerekos call`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `POST` | `/api/v1/repos` | Create a repo (git init --bare) |
| `GET` | `/api/v1/repos` | List repos |
| `GET` | `/api/v1/repos/:id` | Get a repo + branches |
| `GET` | `/api/v1/repos/:id/branches` | List branches |
| `POST` | `/api/v1/repos/:id/branches` | Create branch |
| `POST` | `/api/v1/repos/:id/commit-file` | Commit a file on a branch |
| `GET` | `/api/v1/repos/:id/commits` | List commits (?branch=&limit=) |
| `GET` | `/api/v1/repos/:id/pushes` | List recorded push events |
| `PATCH` | `/api/v1/repos/:id` | Update a repo |
| `DELETE` | `/api/v1/repos/:id` | Delete a repo |
| `GET`/`POST` | `/api/v1/pulls` | Pull requests |
| `GET`/`POST` | `/api/v1/issues` | Issues |
| `GET`/`POST` | `/api/v1/checks` | Check runs |
| `GET`/`POST` | `/git/:project/:repo.git/...` | Git Smart HTTP transport (clone/push/pull, direct port) |

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `GIT_REPOS_ROOT` | `./data/repos` | Bare repo store |
| `GIT_AUTH_TOKEN` | `-` | Optional Bearer/Basic token for the transport |
| `SKIP_GIT` | `0` | Tests/metadata-only; refused when `NODE_ENV=production` |

## Examples

**curl**

```bash
# through the conductor proxy (JWT) — REST only
curl -s -X POST \
  "$CONDUCTOR/api/services/git_manager/api/v1/repos?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
const repos = client.svc.git_manager.resource('repos');
await repos.create(PID, { name: 'demo' });
console.log(await repos.list(PID));
```

**CLI**

```bash
aerekos git_manager repos create --project $PID -d '{"name":"demo"}'
aerekos git_manager repos list --project $PID
```

---

_Hand-aligned with `worker/git_manager` for Wave 3 closeout honesty. Catalog CRUD also lives in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._
