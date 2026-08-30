# notebook_manager — SageMaker notebook

> **AI** · Implemented

Store notebooks; Run launches a compute oneshot (jupyter/python).

- **Port:** `3142`
- **AWS analog:** SageMaker notebook
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/notebook_manager{path}` (JWT or service token)
- **Capabilities:** `notebook`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/notebooks` | Create a notebook ({ project_id, name, ... }) |
| `GET` | `/api/v1/notebooks` | List notebooks (?project_id=) |
| `GET` | `/api/v1/notebooks/:id` | Get one notebook |
| `PATCH` | `/api/v1/notebooks/:id` | Update a notebook |
| `DELETE` | `/api/v1/notebooks/:id` | Delete a notebook |
| `POST` | `/api/v1/notebooks/:id/run` | Run notebook via compute oneshot |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/notebook_manager/api/v1/notebooks?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
const r = client.resource('notebook_manager', 'notebooks');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos notebook_manager notebooks create --project $PID --data '{"name":"demo"}'
aerekos notebook_manager notebooks list --project $PID
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._
