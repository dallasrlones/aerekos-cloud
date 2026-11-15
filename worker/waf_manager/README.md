# waf_manager

**AWS analog:** WAF · **Port:** `3146`

Project-scoped **WAF rules** (CRUD `/api/v1/rules`) plus `POST /api/v1/ensure-defaults` (seeds `default-rate` when empty) and `POST /api/v1/evaluate` (local matcher: exact `cidr` string equality and path prefix). SQLite via `aerekos-record`. Not Cloudflare / AWS WAF. No production mocks — `assertNoSkipFakes()` + `createManagerApp` refuse skip-fake flags when `NODE_ENV=production`.

## Status

**MVP / implemented** — rules CRUD, ensure-defaults, evaluate, `/health`, `/ready`, `/api/v1/info`, `/metrics`.

**Parked:** live conductor proxy e2e (needs stack + enabled `waf_manager` on a non-prod project). Evaluate is a local rule table check — not a cloud WAF engine.

**Tutorial:** none standalone. Console uses generic **ManagerConsole** for `waf_manager` (no dedicated WafManager ServiceGuide).

## Access

- Direct: `http://localhost:3146/...`
- Conductor proxy: `{CONDUCTOR}/api/services/waf_manager{path}` (JWT or service token)

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`) |
| `POST` | `/api/v1/ensure-defaults` | Seed default-rate rule if missing |
| `POST` | `/api/v1/evaluate` | Local allow/block from stored rules |
| `POST` | `/api/v1/rules` | Create (`project_id`, `name`, optional `action` / `cidr` / `path` / `rate`) |
| `GET` | `/api/v1/rules` | List (`?project_id=`) |
| `GET` | `/api/v1/rules/:id` | Get one |
| `PATCH`/`PUT` | `/api/v1/rules/:id` | Update |
| `DELETE` | `/api/v1/rules/:id` | Delete |

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/waf_manager.yaml`](../../docs/openapi/waf_manager.yaml). Catalog mirror: [`docs/services/waf_manager.md`](../../docs/services/waf_manager.md).

## SDK / CLI

- **SDK (Node):** generic `client.resource('waf_manager', 'rules')` / `client.proxy`; evaluate via proxy `POST /api/v1/evaluate`.
- **CLI:** `aerekos waf_manager rules list|get|create|update|delete --project $PID` (and `-d` / `--data` JSON). Evaluate via `aerekos call` or curl.

## Quick start

```bash
cd worker/waf_manager
cp .env_example .env   # optional
npm install   # use Node 20 (.nvmrc)
npm start
# curl http://localhost:3146/health
```

## Environment

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | `3146` | Listen port |
| `DATABASE_PATH` | `data/waf_manager.db` | SQLite file |
| `SKIP_SERVICE_REGISTRATION` | unset | `true` in tests |
| `CONDUCTOR_URL` | unset | Optional auto-registration |

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | prod skip-fake guard + bootstrap wiring |
| Integration | `npm run test:integration` | health/ready/info, CRUD, evaluate |
| All | `npm test` | unit + integration |
| Live e2e | parked | See [`tests/e2e/README.md`](./tests/e2e/README.md) — needs conductor |

## Related

- Conductor seed / `managerServicePorts` → `3146`
- Root [`GOLDEN_PATH.md`](../../GOLDEN_PATH.md)
