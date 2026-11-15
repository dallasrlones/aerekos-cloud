# cdn_manager — CloudFront

> **Edge** · Implemented

Project-scoped **cache rules** (path pattern, origin, TTL) plus optional Cloudflare **purge**. CF Cache Rulesets write / WAF helpers are **parked** (EDGE-PRO-4) and never claim `applied: true` without a live write. No production skip-fake flags (`assertNoSkipFakes()`). **Tutorial:** none — ManagerConsole / EdgeManager have no `CONSOLE_GUIDES.cdn_manager`.

- **Port:** `3118`
- **AWS analog:** CloudFront
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/cdn_manager{path}` (JWT or service token)
- **Capabilities:** `cdn`, `cache-rules`
- **OpenAPI:** `worker/cdn_manager/api/openapi.yaml` (pack copy: `docs/openapi/cdn_manager.yaml`)
- **SDK/CLI:** generic `client.resource('cdn_manager', 'rules')` / `client.proxy`; CLI `aerekos cdn_manager rules …` / `aerekos call`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `POST` | `/api/v1/rules` | Create a rule ({ project_id, name, ... }) |
| `GET` | `/api/v1/rules` | List rules (?project_id=) |
| `GET` | `/api/v1/rules/:id` | Get one rule |
| `PATCH`/`PUT` | `/api/v1/rules/:id` | Update a rule |
| `DELETE` | `/api/v1/rules/:id` | Delete a rule |
| `POST` | `/api/v1/rules/:id/probe` | Probe origin |
| `POST` | `/api/v1/purge` | Cloudflare purge (creds required) |
| `POST` | `/api/v1/cache-rules` | Parked CF Cache Rules write |
| `POST` | `/api/v1/waf` | Parked WAF intent |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/cdn_manager/api/v1/rules?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo","path_pattern":"/a/*","origin":"https://o.example","cache_ttl_seconds":"60"}'
```

**SDK (Node)**

```js
const r = client.resource('cdn_manager', 'rules');
await r.create(PID, { name: 'demo', path_pattern: '/a/*', origin: 'https://o.example', cache_ttl_seconds: '60' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos cdn_manager rules create --project $PID --data '{"name":"demo","path_pattern":"/a/*","origin":"https://o.example","cache_ttl_seconds":"60"}'
aerekos cdn_manager rules list --project $PID
```

---

_Hand-aligned with `worker/cdn_manager` for Wave 4 closeout honesty. Catalog CRUD also lives in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._
