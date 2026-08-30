# function_manager — Lambda

> **Compute** · Implemented

Functions.

- **Port:** `3139`
- **AWS analog:** Lambda
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/function_manager{path}` (JWT or service token)
- **Capabilities:** `lambda`, `functions`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/functions` | Create a function ({ project_id, name, ... }) |
| `GET` | `/api/v1/functions` | List functions (?project_id=) |
| `GET` | `/api/v1/functions/:id` | Get one function |
| `PATCH` | `/api/v1/functions/:id` | Update a function |
| `DELETE` | `/api/v1/functions/:id` | Delete a function |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/function_manager/api/v1/functions?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
const r = client.resource('function_manager', 'functions');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos function_manager functions create --project $PID --data '{"name":"demo"}'
aerekos function_manager functions list --project $PID
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._
