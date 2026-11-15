# Balancer Manager

**AWS analog:** ELB · **Port:** `3109`

Project-scoped **target hints** (CRUD `/api/v1/targets`) with optional HTTP health probes (`GET …/targets/health`, `GET …/targets/:id/health`). SQLite via `aerekos-record`. Complements conductor LoadBalancer metadata. **Cloud LB provisioning is out of scope** for MVP.

No production mocks — `assertNoSkipFakes()` on boot refuses shared skip-fake flags (`SKIP_HEALTH`, `SKIP_DOCKER`, …) when `NODE_ENV=production`.

## Status

**MVP / implemented** — targets CRUD, health summary probes, `/health`, `/ready`, `/api/v1/info`, `/metrics`.

**Tutorial:** none standalone. No dedicated BalancerManager console screen (AI attach-balancer uses `client.balancer` / target ids).

## Access

- Direct: `http://localhost:3109/...`
- Conductor proxy: `{CONDUCTOR}/api/services/balancer_manager{path}` (JWT or service token)

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`) |
| `POST` | `/api/v1/targets` | Create (`project_id`, `name`, `address?`, `pool?`, …) |
| `GET` | `/api/v1/targets` | List (`?project_id=`) |
| `GET` | `/api/v1/targets/:id` | Get one |
| `PATCH`/`PUT` | `/api/v1/targets/:id` | Update |
| `DELETE` | `/api/v1/targets/:id` | Delete |
| `GET` | `/api/v1/targets/health` | Probe all / `?pool=` |
| `GET` | `/api/v1/targets/:id/health` | Probe one |

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/balancer_manager.yaml`](../../docs/openapi/balancer_manager.yaml). Catalog mirror: [`docs/services/balancer_manager.md`](../../docs/services/balancer_manager.md).

## SDK / CLI

- **SDK (Node):** typed `client.balancer.list|create|health|remove` · also generic `client.resource('balancer_manager', 'targets')` / `client.proxy`.
- **CLI:** `aerekos call balancer_manager POST "/api/v1/targets" --project $PID --data '{"name":"demo","address":"http://…"}'` (no dedicated `aerekos balancer` verb required).

## Quick start

```bash
cd worker/balancer_manager
cp .env_example .env
npm install
npm start
# curl http://localhost:3109/health
```

## Environment

See [`.env_example`](./.env_example). Notable:

| Variable | Meaning |
|----------|---------|
| `DATABASE_PATH` | SQLite file |
| `SKIP_HEALTH` | `1` = skip live probes in healthSummary (**tests only**; prod guard refuses) |
| `SKIP_DOCKER` | shared skip flag (**tests only**; prod guard refuses) |
| `CONDUCTOR_URL` | Optional; enables registration with conductor |

## Docker

Build context is the parent `worker/` directory:

```bash
docker compose -f docker-compose.yml up --build
```

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | prod guards + BalancerTargetService |
| Integration | `npm run test:integration` | health/ready/info/metrics + targets CRUD |
| All | `npm test` | unit + integration |
| E2E | [`tests/e2e/README.md`](./tests/e2e/README.md) | live proxy parked; root `e2e/catalog.js` |

## Related

- Conductor registration / proxy · AI attach-balancer
- Root [`GOLDEN_PATH.md`](../../GOLDEN_PATH.md)
