# cert_manager

**AWS analog:** ACM · **Port:** `3137`

Project-scoped **certs** (CRUD `/api/v1/certs`) plus `POST /api/v1/certs/mint` (self-signed PEM) and `POST /api/v1/certs/import` (PEM bundle). SQLite via `aerekos-record`. **No Let's Encrypt / ACME** in this MVP. No production mocks — `createManagerApp` → `assertNoSkipFakes()` refuses shared skip-fake flags when `NODE_ENV=production`.

## Status

**MVP / implemented** — certs CRUD, mint, import, `ensure-defaults` (seed `default` when empty), `/health`, `/ready`, `/api/v1/info`, `/metrics`.

**Tutorial:** none standalone. Console uses generic **ManagerConsole** (no dedicated CertManager screen / in-app ServiceGuide).

## Access

- Direct: `http://localhost:3137/...`
- Conductor proxy: `{CONDUCTOR}/api/services/cert_manager{path}` (JWT or service token)

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`) |
| `POST` | `/api/v1/ensure-defaults` | Seed `default` cert if project empty |
| `POST` | `/api/v1/certs` | Create (`project_id`, `name`, …) |
| `GET` | `/api/v1/certs` | List (`?project_id=`) |
| `GET` | `/api/v1/certs/:id` | Get one |
| `PATCH` | `/api/v1/certs/:id` | Update |
| `DELETE` | `/api/v1/certs/:id` | Delete |
| `POST` | `/api/v1/certs/mint` | Mint self-signed PEM (`name`, optional `cn`) |
| `POST` | `/api/v1/certs/import` | Import PEM (`name`, `pem` / `certificate`) |

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/cert_manager.yaml`](../../docs/openapi/cert_manager.yaml). Catalog mirror: [`docs/services/cert_manager.md`](../../docs/services/cert_manager.md).

## SDK / CLI

- **SDK (Node):** generic `client.resource('cert_manager', 'certs')` or `client.proxy('cert_manager', …)`. No typed `client.certs` helper.
- **CLI:** `aerekos cert_manager certs list|get|create|update|delete --project $PID` · mint/import via `aerekos call cert_manager POST "/api/v1/certs/mint" …`

## Quick start

```bash
cd worker/cert_manager
cp .env_example .env
npm install   # use Node 20 (.nvmrc)
npm start
# curl http://localhost:3137/health
```

## Environment

See [`.env_example`](./.env_example). Set `CONDUCTOR_URL` for auto-registration with the conductor.

## Docker

Build context is the parent `worker/` directory:

```bash
docker compose -f docker-compose.yml up --build
```

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | prod-guard + mint/import PEM |
| Integration | `npm run test:integration` | health/ready/info + certs CRUD/mint/import |
| All | `npm test` | unit + integration |
| E2E | [`tests/e2e/README.md`](./tests/e2e/README.md) | live proxy parked; root `e2e/catalog.js` |

## Related

- Conductor registration / proxy · ManagerConsole
- Root [`GOLDEN_PATH.md`](../../GOLDEN_PATH.md)
