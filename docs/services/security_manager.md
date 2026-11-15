# security_manager — Security Hub

> **Observability** · Implemented

Project-scoped security finding rows (`severity`/`source`/`details`) plus metadata-only scan. Detectors / SIEM wired later. **Tutorial / ServiceGuide:** none standalone — console generic **ManagerConsole** (no dedicated `CONSOLE_GUIDES` entry). No production skip-fake mocks (`assertNoSkipFakes` on boot).

- **Port:** `3108`
- **AWS analog:** Security Hub
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/security_manager{path}` (JWT or service token)
- **Capabilities:** `security`, `findings`
- **OpenAPI:** `worker/security_manager/api/openapi.yaml` (pack copy: `docs/openapi/security_manager.yaml`)
- **SDK/CLI:** `client.resource('security_manager', 'findings')`; CLI `aerekos security_manager findings …` / `aerekos call`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `POST` | `/api/v1/findings` | Create a finding ({ project_id, name, ... }) |
| `GET` | `/api/v1/findings` | List findings (?project_id=) |
| `GET` | `/api/v1/findings/:id` | Get one finding |
| `PATCH` | `/api/v1/findings/:id` | Update a finding |
| `POST` | `/api/v1/findings/scan` | Metadata-only scan note (no live scanner) |
| `DELETE` | `/api/v1/findings/:id` | Delete a finding |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/security_manager/api/v1/findings?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo","severity":"low","source":"manual","details":"{}"}'
```

**SDK (Node)**

```js
const r = client.resource('security_manager', 'findings');
await r.create(PID, { name: 'demo', severity: 'low', source: 'manual', details: '{}' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos security_manager findings create --project $PID --data '{"name":"demo","severity":"low","source":"manual","details":"{}"}'
aerekos security_manager findings list --project $PID
aerekos call security_manager POST "/api/v1/findings/scan" --project $PID -d '{"summary":"metadata only"}'
```

---

_Hand-aligned with `worker/security_manager` for Wave 6 closeout honesty. Catalog CRUD also lives in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._
