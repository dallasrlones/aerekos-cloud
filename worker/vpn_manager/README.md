# vpn_manager

**AWS analog:** Client VPN · **Port:** `3147`

Project-scoped **VPN peer** rows (`name`, `config`, `status`) plus Headscale preauth keys when configured. SQLite via `aerekos-record`. Shared skip-fake flags are refused in production via `assertNoSkipFakes`.

## Status / honesty

| Claim | Reality |
|-------|---------|
| CRUD | Real SQLite peers via `/api/v1/peers` |
| Headscale | `POST /api/v1/preauth-keys` calls Headscale when `HEADSCALE_URL` + `HEADSCALE_API_KEY` are set |
| Without Headscale | `GET /api/v1/status` → `{ hooked_up: false, missing }`; preauth create → **503** |
| Client VPN parity | Naming analog only — no AWS Client VPN client |
| Prod mocks | No skip-fakes / `MOCK_KEY_MANAGER` when `NODE_ENV=production` |
| Tutorial | **None** standalone — console generic **ManagerConsole** (no `CONSOLE_GUIDES` entry) |

## Access

- Direct: `http://localhost:3147/...`
- Conductor proxy: `{CONDUCTOR}/api/services/vpn_manager{path}` (JWT or service token)

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`) |
| `GET` | `/api/v1/status` | Headscale hookup status |
| `POST` | `/api/v1/ensure-defaults` | Seed default `laptop` peer if missing |
| `POST` | `/api/v1/peers` | Create (`project_id`, `name`, …) |
| `GET` | `/api/v1/peers` | List (`?project_id=`) |
| `GET` | `/api/v1/peers/:id` | Get one |
| `PATCH`/`PUT` | `/api/v1/peers/:id` | Update |
| `DELETE` | `/api/v1/peers/:id` | Delete |
| `POST` | `/api/v1/preauth-keys` | Headscale preauth key (or 503 not-hooked-up) |

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/vpn_manager.yaml`](../../docs/openapi/vpn_manager.yaml). Catalog: [`docs/services/vpn_manager.md`](../../docs/services/vpn_manager.md).

## SDK / CLI

- **SDK (Node):** `client.resource('vpn_manager', 'peers')` (create/list/get/update/delete). Status/preauth via SDK/`aerekos call` / curl.
- **CLI:** `aerekos vpn_manager peers list|get|create|update|delete --project $PID` (and `-d` JSON for create/update), or generic `aerekos call`.

## Quick start

```bash
cd worker/vpn_manager
cp .env_example .env   # optional
npm install            # Node 20+
npm start
# curl http://localhost:3147/health
```

## Environment

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | `3147` | Listen port |
| `DATABASE_PATH` | `data/vpn_manager.db` | SQLite file |
| `HEADSCALE_URL` | unset | Required for live preauth keys |
| `HEADSCALE_API_KEY` | unset | Required for live preauth keys |
| `SKIP_SERVICE_REGISTRATION` | unset | `true` in tests |
| `CONDUCTOR_URL` | unset | Optional auto-registration |

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | prod guard + `assertNoSkipFakes` wiring |
| Integration | `npm run test:integration` | health/ready/info/metrics + peers CRUD + Headscale honesty |
| All | `npm test` | unit + integration |
| Live e2e | needs conductor | Proxy path parked; root `e2e/catalog.js` lists CRUD |

## Related

- Conductor seed / `managerServicePorts` → `3147`
- Live Headscale + conductor proxy e2e parked (see [`tests/e2e/README.md`](./tests/e2e/README.md))
- Root [`GOLDEN_PATH.md`](../../GOLDEN_PATH.md)
