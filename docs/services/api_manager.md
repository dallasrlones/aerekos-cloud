# api_manager — API Gateway

> **Dev tools** · Implemented

Gateway route metadata (method / `public_path` → `target_service` + ARN) plus hosted **Data API** (schema apply → SQLite CRUD, hooks, scale). Does **not** terminate public TLS or reverse-proxy itself — conductor `GatewayService` matches then proxies. **Tutorial:** none standalone; console **ApiGatewayManager** ships an in-app **ServiceGuide**. No production mocks — boot `assertNoSkipFakes()` refuses `SKIP_INVOKE` / `SKIP_DB_PROVISION` / `SKIP_WAF` when `NODE_ENV=production`.

- **Port:** `3124`
- **AWS analog:** API Gateway
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/api_manager{path}` (JWT or service token)
- **Capabilities:** `api-gateway`, `routing`
- **OpenAPI:** `worker/api_manager/api/openapi.yaml` (pack copy: `docs/openapi/api_manager.yaml`)

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `POST` | `/api/v1/ensure-defaults` | Seed Data API defaults |
| `POST` | `/api/v1/endpoints` | Create a route (`project_id`, `name`, …) |
| `GET` | `/api/v1/endpoints` | List routes (`?project_id=`) |
| `GET` | `/api/v1/endpoints/:id` | Get one route |
| `PATCH` | `/api/v1/endpoints/:id` | Update a route |
| `DELETE` | `/api/v1/endpoints/:id` | Delete a route |
| `POST` | `/api/v1/endpoints/seed-presets` | Upsert shared gateway presets |
| `POST` | `/api/v1/endpoints/match` | Resolve method+path → `proxy_path` + ARN |
| `PATCH` | `/api/v1/endpoints/:id/scale` | Set desired replicas metadata |
| `POST` | `/api/v1/data-apis/apply` | Apply model schema → Data API |
| `GET` | `/api/v1/data-apis` | List Data APIs |
| `*` | `/api/v1/data/:app/:Model…` | Hosted Data API record CRUD |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/api_manager/api/v1/endpoints?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo","method":"GET","public_path":"/v1/demo","target_service":"ai_manager","target_path":"/api/v1/info","resource_arn_template":"arn:aerekos:{project_id}:demo"}'
```

**SDK (Node)**

```js
const r = client.resource('api_manager', 'endpoints');
await r.create(PID, { name: 'demo', method: 'GET', public_path: '/v1/demo' });
console.log(await r.list(PID));
// Data API: client.dataApi.apply|list|create|…
```

**CLI**

```bash
aerekos api_manager endpoints create --project $PID --data '{"name":"demo","method":"GET","public_path":"/v1/demo"}'
aerekos api_manager endpoints list --project $PID
```

---

_Hand-aligned with `worker/api_manager` for Wave 3 closeout honesty. Catalog extras live in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._
