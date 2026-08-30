# git_manager — CodeCommit

> **Dev tools** · Implemented

Self-hosted Git hosting: bare repos + full clone/push/pull over Git Smart HTTP, plus push-event hooks.

- **Port:** `3130`
- **AWS analog:** CodeCommit
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/git_manager{path}` (JWT or service token)
- **Capabilities:** `git`, `scm`, `smart-http`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/repos` | Create a repo (git init --bare) |
| `GET` | `/api/v1/repos` | List repos |
| `GET` | `/api/v1/repos/:id` | Get a repo + branches |
| `GET` | `/api/v1/repos/:id/branches` | List branches |
| `GET` | `/api/v1/repos/:id/commits` | List commits (?branch=&limit=) |
| `GET` | `/api/v1/repos/:id/pushes` | List recorded push events |
| `PATCH` | `/api/v1/repos/:id` | Update a repo |
| `DELETE` | `/api/v1/repos/:id` | Delete a repo |
| `GET/POST` | `/git/:project/:repo.git/...` | Git Smart HTTP transport (clone/push/pull, direct port) |

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `GIT_REPOS_ROOT` | `./data/repos` | Bare repo store |
| `GIT_AUTH_TOKEN` | `-` | Optional Bearer/Basic token for the transport |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/git_manager/api/v1/repos?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
// generic proxy
await client.proxy('git_manager', { method: 'POST', path: '/api/v1/repos', projectId: PID, body: { name: 'demo' } });
```

**CLI**

```bash
aerekos call git_manager POST "/api/v1/repos" --project $PID --data '{"name":"demo"}'
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._
