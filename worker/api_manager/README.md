# api_manager

**AWS analog:** API Gateway · **Port:** `3124`

Project-scoped **gateway routes** (`/api/v1/endpoints`) with path-template match → target service/ARN, plus hosted **Data API** (schema apply → SQLite CRUD, hooks, scale). SQLite via `aerekos-record`. No production mocks — boot calls `assertNoSkipFakes()` so `SKIP_INVOKE` / `SKIP_DB_PROVISION` / `SKIP_WAF` are refused when `NODE_ENV=production`.

**Honesty:** this service stores route metadata and resolves matches for conductor’s edge gateway. It does **not** terminate public TLS or reverse-proxy traffic itself — conductor `GatewayService` calls `POST /api/v1/endpoints/match` then proxies to `target_service`.

## Status

**MVP / implemented** — endpoints CRUD, seed-presets, match (+ optional WAF evaluate), scale, Data API apply/CRUD/nested/autoscaling, `/health`, `/ready`, `/api/v1/info`, `/metrics`, `ensure-defaults`.

**Tutorial:** none standalone. Console **ApiGatewayManager** screen ships an in-app **ServiceGuide**.

## Access

- Direct: `http://localhost:3124/...`
- Conductor proxy: `{CONDUCTOR}/api/services/api_manager{path}` (JWT or service token)
- Pretty public paths (when `PUBLIC_API_URL` / conductor edge is configured): matched via gateway, not raw `/api/services/…`

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`) |
| `POST` | `/api/v1/ensure-defaults` | Seed Data API defaults for project |
| `POST` | `/api/v1/endpoints` | Create route (`project_id`, `name`, method/path/target/ARN…) |
| `GET` | `/api/v1/endpoints` | List (`?project_id=`) |
| `GET` | `/api/v1/endpoints/:id` | Get one |
| `PATCH` | `/api/v1/endpoints/:id` | Update |
| `DELETE` | `/api/v1/endpoints/:id` | Delete |
| `POST` | `/api/v1/endpoints/seed-presets` | Upsert shared gateway presets |
| `POST` | `/api/v1/endpoints/match` | Resolve method+path → target + `proxy_path` + ARN |
| `PATCH` | `/api/v1/endpoints/:id/scale` | Set `desired` replicas metadata |
| `POST` | `/api/v1/data-apis/apply` | Apply model schema → Data API |
| `GET` | `/api/v1/data-apis` | List Data APIs |
| `GET` | `/api/v1/data-apis/:name` | Get one |
| `POST` | `/api/v1/data-apis/:name/scale` | Scale desired |
| `POST` | `/api/v1/data-apis/:name/autoscaling/evaluate` | Autoscaling evaluate |
| `*` | `/api/v1/data/:app/:Model…` | Hosted Data API record CRUD (+ nested) |

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/api_manager.yaml`](../../docs/openapi/api_manager.yaml). Catalog mirror: [`docs/services/api_manager.md`](../../docs/services/api_manager.md).

## SDK / CLI

- **SDK (Node):** `client.dataApi.apply|list|create|…`; generic CRUD `client.resource('api_manager', 'endpoints')`.
- **CLI:** `aerekos api_manager endpoints list|get|create|update|delete --project $PID` (and `-d` JSON for create/update). Match/seed/Data API via SDK or `aerekos call` / curl.

## Quick start

```bash
cd worker/api_manager
npm install   # use Node 20 (.nvmrc)
npm start
# curl http://localhost:3124/health
```

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | prod skip-flag guards |
| Integration | `npm run test:integration` | health, CRUD, match/ARN, seed-presets, Data API |
| All | `npm test` | unit + integration |
| E2E | [`tests/e2e/README.md`](./tests/e2e/README.md) | proxy + root `e2e/catalog.js` / gateway waves |

## Related

- Conductor registration / `GatewayService` edge match → proxy
- ApiGatewayManager ServiceGuide · `waf_manager` (optional match evaluate)
- `function_manager` (Data API hooks) · `db_manager` (non-sqlite provision)
- Root [`GOLDEN_PATH.md`](../../GOLDEN_PATH.md)
