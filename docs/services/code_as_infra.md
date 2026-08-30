# code_as_infra — CloudFormation

> **Dev tools** · Implemented

Infrastructure-as-code modules / snippets (kind + content).

- **Port:** `3120`
- **AWS analog:** CloudFormation
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/code_as_infra{path}` (JWT or service token)
- **Capabilities:** `iac`, `modules`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/modules` | Create a module ({ project_id, name, ... }) |
| `GET` | `/api/v1/modules` | List modules (?project_id=) |
| `GET` | `/api/v1/modules/:id` | Get one module |
| `PATCH` | `/api/v1/modules/:id` | Update a module |
| `DELETE` | `/api/v1/modules/:id` | Delete a module |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/code_as_infra/api/v1/modules?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
const r = client.resource('code_as_infra', 'modules');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos code_as_infra modules create --project $PID --data '{"name":"demo"}'
aerekos code_as_infra modules list --project $PID
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._
