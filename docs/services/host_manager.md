# host_manager — EC2 / SSM inventory

> **Platform** · Implemented

Project-scoped host inventory (`name`/`hostname`/`address`/`role`/`metadata`) plus optional sync from conductor `/api/workers`. Not a second fleet to register by hand for sync; not live EC2/SSM. **Tutorial / ServiceGuide:** none standalone — console generic **ManagerConsole** (no dedicated `CONSOLE_GUIDES` entry). No production skip-fake mocks (`assertNoSkipFakes`).

- **Port:** `3122`
- **AWS analog:** EC2 / SSM inventory
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/host_manager{path}` (JWT or service token)
- **Capabilities:** `inventory`, `hosts`
- **OpenAPI:** `worker/host_manager/api/openapi.yaml` (pack copy: `docs/openapi/host_manager.yaml`)
- **SDK/CLI:** `client.resource('host_manager', 'hosts')`; CLI `aerekos host_manager hosts …` / `aerekos call`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `POST` | `/api/v1/sync` | Sync hosts from conductor workers |
| `POST` | `/api/v1/hosts` | Create a host ({ project_id, name, ... }) |
| `GET` | `/api/v1/hosts` | List hosts (?project_id=) |
| `GET` | `/api/v1/hosts/:id` | Get one host |
| `PATCH` | `/api/v1/hosts/:id` | Update a host |
| `DELETE` | `/api/v1/hosts/:id` | Delete a host |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/host_manager/api/v1/hosts?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo","hostname":"demo","address":"10.0.0.1"}'
```

**SDK (Node)**

```js
const r = client.resource('host_manager', 'hosts');
await r.create(PID, { name: 'demo', hostname: 'demo', address: '10.0.0.1' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos host_manager hosts create --project $PID --data '{"name":"demo","hostname":"demo","address":"10.0.0.1"}'
aerekos host_manager hosts list --project $PID
aerekos call host_manager POST "/api/v1/sync" --project $PID --data '{"project_id":"'"$PID"'"}'
```

---

_Hand-aligned with `worker/host_manager` for Wave 5 closeout honesty. Catalog CRUD + sync also live in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._
