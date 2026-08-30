# cicd_manager — CodePipeline

> **Dev tools** · Implemented

Pipeline definitions (steps JSON + state). Real runners are future work.

- **Port:** `3119`
- **AWS analog:** CodePipeline
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/cicd_manager{path}` (JWT or service token)
- **Capabilities:** `ci-cd`, `pipelines`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/pipelines` | Create a pipeline ({ project_id, name, ... }) |
| `GET` | `/api/v1/pipelines` | List pipelines (?project_id=) |
| `GET` | `/api/v1/pipelines/:id` | Get one pipeline |
| `PATCH` | `/api/v1/pipelines/:id` | Update a pipeline |
| `DELETE` | `/api/v1/pipelines/:id` | Delete a pipeline |

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

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._
