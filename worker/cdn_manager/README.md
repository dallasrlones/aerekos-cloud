# CDN Manager

**AWS analog:** CloudFront · **Port:** `3118`

Project-scoped **cache rules** (CRUD `/api/v1/rules` — path pattern, origin, TTL) plus optional Cloudflare **purge** (`POST /api/v1/purge`) when `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ZONE_ID` are set. SQLite via `aerekos-record`. Live Cloudflare Cache Rulesets write and EdgeManager CDN tab are **parked** (EDGE-PRO-4) — see [`plan.md`](./plan.md) / [`docs/plans/cdn_manager.md`](../../docs/plans/cdn_manager.md).

No production mocks — `assertNoSkipFakes()` on boot refuses shared skip-fake flags (including `SKIP_CLOUDFLARE`) when `NODE_ENV=production`. Cache-rule / WAF CF helpers never claim `applied: true` without a live API write.

## Status

**MVP / implemented** — rules CRUD, probe, purge (live when CF creds present), parked cache-rules/WAF intent endpoints, `/health`, `/ready`, `/api/v1/info`, `/metrics`.

**Tutorial / ServiceGuide:** none. Console uses generic **ManagerConsole** / **EdgeManager** (no `CONSOLE_GUIDES.cdn_manager`).

## Access

- Direct: `http://localhost:3118/...`
- Conductor proxy: `{CONDUCTOR}/api/services/cdn_manager{path}` (JWT or service token)

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`) |
| `POST` | `/api/v1/rules` | Create (`project_id`, `name`, …) |
| `GET` | `/api/v1/rules` | List (`?project_id=`) |
| `GET` | `/api/v1/rules/:id` | Get one |
| `PATCH`/`PUT` | `/api/v1/rules/:id` | Update |
| `DELETE` | `/api/v1/rules/:id` | Delete |
| `POST` | `/api/v1/rules/:id/probe` | HTTP probe origin+path |
| `POST` | `/api/v1/purge` | Cloudflare purge (creds required) |
| `POST` | `/api/v1/cache-rules` | Parked CF Cache Rules write |
| `POST` | `/api/v1/waf` | Parked WAF intent note |

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/cdn_manager.yaml`](../../docs/openapi/cdn_manager.yaml). Catalog mirror: [`docs/services/cdn_manager.md`](../../docs/services/cdn_manager.md).

## SDK / CLI

- **SDK (Node):** generic `client.resource('cdn_manager', 'rules')` or `client.proxy('cdn_manager', …)`. No typed `client.cdn` helper.
- **CLI:** `aerekos cdn_manager rules list|get|create|update|delete --project $PID` · purge via `aerekos call cdn_manager POST "/api/v1/purge" …`

## Quick start

```bash
cd worker/cdn_manager
cp .env_example .env
npm install
npm start
# curl http://localhost:3118/health
```

## Environment

See [`.env_example`](./.env_example). Set `CONDUCTOR_URL` for auto-registration. Optional `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ZONE_ID` for live purge.

## Docker

Build context is the parent `worker/` directory:

```bash
docker compose -f docker-compose.yml up --build
```

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | prod guards + CloudflareEdge honesty |
| Integration | `npm run test:integration` | health/ready/info + rules CRUD |
| All | `npm test` | unit + integration |
| E2E | [`tests/e2e/README.md`](./tests/e2e/README.md) | live proxy parked; needs conductor |

## Related

- Conductor registration / proxy · EdgeManager console
- `domain_manager` (zone) · `secrets_manager` (CF token)
- Root [`GOLDEN_PATH.md`](../../GOLDEN_PATH.md)
