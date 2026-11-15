# waf_manager — WAF

> **Edge** · Implemented

WAF rule records (`name`/`action`/`cidr`/`path`/`rate`) plus `ensure-defaults` and local `evaluate` (exact cidr string / path prefix — not Cloudflare/AWS WAF). No production mocks (`assertNoSkipFakes` via index + `createManagerApp`). **Tutorial:** none standalone — generic ManagerConsole (no dedicated WafManager ServiceGuide). Live conductor e2e parked.

- **Port:** `3146`
- **AWS analog:** WAF
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/waf_manager{path}` (JWT or service token)
- **Capabilities:** `waf`
- **OpenAPI:** `worker/waf_manager/api/openapi.yaml` (pack copy: `docs/openapi/waf_manager.yaml`)
- **SDK/CLI:** generic `client.resource('waf_manager', 'rules')` / `client.proxy`; CLI `aerekos waf_manager rules …` / `aerekos call`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `POST` | `/api/v1/ensure-defaults` | Seed default-rate rule if missing |
| `POST` | `/api/v1/evaluate` | Local allow/block from stored rules |
| `POST` | `/api/v1/rules` | Create a rule ({ project_id, name, ... }) |
| `GET` | `/api/v1/rules` | List rules (?project_id=) |
| `GET` | `/api/v1/rules/:id` | Get one rule |
| `PATCH`/`PUT` | `/api/v1/rules/:id` | Update a rule |
| `DELETE` | `/api/v1/rules/:id` | Delete a rule |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/waf_manager/api/v1/rules?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo","action":"block","path":"/admin"}'

curl -s -X POST \
  "$CONDUCTOR/api/services/waf_manager/api/v1/evaluate" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","path":"/admin/x","ip":"1.2.3.4"}'
```

**SDK (Node)**

```js
const r = client.resource('waf_manager', 'rules');
await r.create(PID, { name: 'demo', action: 'block', path: '/admin' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos waf_manager rules create --project $PID --data '{"name":"demo","action":"block","path":"/admin"}'
aerekos waf_manager rules list --project $PID
```

---

_Hand-aligned with `worker/waf_manager` for Wave 7 closeout honesty. Catalog CRUD also lives in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._
