# billing_manager — Cost Explorer

> **Management** · Implemented

Usage meters. `/evaluate-quota` uses real counts and denies when over; never `{ unlimited: true }`. `ensure-defaults` seeds default meters. No production mocks (`assertNoSkipFakes` via `createManagerApp`). **Tutorial:** none standalone — generic ManagerConsole (no dedicated BillingManager ServiceGuide).

- **Port:** `3138`
- **AWS analog:** Cost Explorer
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/billing_manager{path}` (JWT or service token)
- **Capabilities:** `billing`, `quotas`
- **OpenAPI:** `worker/billing_manager/api/openapi.yaml` (pack copy: `docs/openapi/billing_manager.yaml`)
- **SDK/CLI:** generic `client.resource('billing_manager', 'meters')` / `client.proxy`; CLI `aerekos billing_manager meters …` / `aerekos call`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `POST` | `/api/v1/ensure-defaults` | Seed default meters if missing |
| `POST` | `/api/v1/evaluate-quota` | Evaluate quota (deny when over) |
| `POST` | `/api/v1/meters` | Create a meter ({ project_id, name, ... }) |
| `GET` | `/api/v1/meters` | List meters (?project_id=) |
| `GET` | `/api/v1/meters/:id` | Get one meter |
| `PATCH`/`PUT` | `/api/v1/meters/:id` | Update a meter |
| `DELETE` | `/api/v1/meters/:id` | Delete a meter |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/billing_manager/api/v1/meters?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'

curl -s -X POST \
  "$CONDUCTOR/api/services/billing_manager/api/v1/evaluate-quota" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","meter":"compute_seconds"}'
```

**SDK (Node)**

```js
const r = client.resource('billing_manager', 'meters');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos billing_manager meters create --project $PID --data '{"name":"demo"}'
aerekos billing_manager meters list --project $PID
```

---

_Hand-aligned with `worker/billing_manager` for Wave 4 closeout honesty. Catalog CRUD + evaluate-quota also live in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._
