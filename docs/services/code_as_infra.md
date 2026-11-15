# code_as_infra — CloudFormation

> **Dev tools** · Experimental (MVP)

Infrastructure-as-code **modules / snippets** (kind + content) stored in SQLite. **No apply/plan engine** in this MVP — CloudFormation is a naming analog only. **Tutorial / ServiceGuide:** none. No production mocks (`SKIP_SERVICE_REGISTRATION` is test/dev only).

- **Port:** `3120`
- **AWS analog:** CloudFormation
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/code_as_infra{path}` (JWT or service token)
- **Capabilities:** `iac`, `modules`
- **OpenAPI:** `worker/code_as_infra/api/openapi.yaml` (pack copy: `docs/openapi/code_as_infra.yaml`)
- **SDK/CLI:** `client.resource('code_as_infra', 'modules')`; CLI `aerekos call` / resource verbs (no dedicated subcommand)

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
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
  -d '{"project_id":"'$PID'","name":"demo","kind":"json","content":"{}"}'
```

**SDK (Node)**

```js
const r = client.resource('code_as_infra', 'modules');
await r.create(PID, { name: 'demo', kind: 'json', content: '{}' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos call code_as_infra POST "/api/v1/modules" --project $PID --data '{"name":"demo","kind":"json","content":"{}"}'
aerekos call code_as_infra GET "/api/v1/modules?project_id=$PID"
```

---

_Hand-aligned with `worker/code_as_infra` for Wave 3 closeout honesty. Catalog CRUD also lives in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._
