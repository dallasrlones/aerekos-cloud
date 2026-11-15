# cicd_manager — CodePipeline

> **Dev tools** · Implemented

Project-scoped **pipelines** (CRUD + `run` / `run-for-repo`). Deploy/build proxies to `compute_manager`; workflow YAML / checks via `git_manager`. Live CI runners executing arbitrary jobs are **out of scope** for MVP. No production mocks (`assertNoSkipFakes()` on boot). **Tutorial:** none standalone — console **CicdManager** screen (no in-app ServiceGuide).

- **Port:** `3119`
- **AWS analog:** CodePipeline
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/cicd_manager{path}` (JWT or service token)
- **Capabilities:** `ci-cd`, `pipelines`
- **OpenAPI:** `worker/cicd_manager/api/openapi.yaml` (pack copy: `docs/openapi/cicd_manager.yaml`)
- **SDK/CLI:** generic `client.resource('cicd_manager', 'pipelines')` / `client.proxy`; CLI `aerekos cicd_manager pipelines …` / `aerekos call`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `POST` | `/api/v1/pipelines` | Create a pipeline ({ project_id, name, ... }) |
| `GET` | `/api/v1/pipelines` | List pipelines (?project_id= · optional environment) |
| `GET` | `/api/v1/pipelines/:id` | Get one pipeline |
| `PATCH`/`PUT` | `/api/v1/pipelines/:id` | Update a pipeline |
| `DELETE` | `/api/v1/pipelines/:id` | Delete a pipeline |
| `POST` | `/api/v1/pipelines/:id/run` | Run (test / deploy / build-image / apply-stack / fleet) |
| `POST` | `/api/v1/pipelines/run-for-repo` | Match + run for a repo push |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/cicd_manager/api/v1/pipelines?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
const r = client.resource('cicd_manager', 'pipelines');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos cicd_manager pipelines create --project $PID --data '{"name":"demo"}'
aerekos cicd_manager pipelines list --project $PID
```

---

_Hand-aligned with `worker/cicd_manager` for Wave 3 closeout honesty. Catalog CRUD also lives in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._
