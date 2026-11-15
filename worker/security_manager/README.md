# security_manager

**AWS analog:** Security Hub · **Port:** `3108`

Project-scoped **security finding** rows (`severity`, `source`, `details`) plus metadata-only `POST /api/v1/findings/scan`. SQLite via `aerekos-record`. Live scanners / SIEM are **out of scope** for MVP. Shared skip-fake flags are refused in production via `assertNoSkipFakes`.

## Status / honesty

| Claim | Reality |
|-------|---------|
| CRUD | Real SQLite findings via `/api/v1/findings` |
| Scan | `POST .../findings/scan` writes a metadata finding only — **no** host reboot / live detector |
| Security Hub parity | Naming analog only — no AWS Security Hub client |
| Prod mocks | No skip-fakes / `MOCK_KEY_MANAGER` when `NODE_ENV=production` |
| Tutorial | **None** standalone — console generic **ManagerConsole** (no `CONSOLE_GUIDES` entry) |

## Access

- Direct: `http://localhost:3108/...`
- Conductor proxy: `{CONDUCTOR}/api/services/security_manager{path}` (JWT or service token)

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`) |
| `POST` | `/api/v1/findings` | Create (`project_id`, `name`, …) |
| `GET` | `/api/v1/findings` | List (`?project_id=`) |
| `GET` | `/api/v1/findings/:id` | Get one |
| `PATCH`/`PUT` | `/api/v1/findings/:id` | Update |
| `POST` | `/api/v1/findings/scan` | Metadata-only scan note |
| `DELETE` | `/api/v1/findings/:id` | Delete |

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/security_manager.yaml`](../../docs/openapi/security_manager.yaml). Catalog: [`docs/services/security_manager.md`](../../docs/services/security_manager.md).

## SDK / CLI

- **SDK (Node):** `client.resource('security_manager', 'findings')` (create/list/get/update/delete). Scan via SDK/`aerekos call` / curl.
- **CLI:** `aerekos security_manager findings list|get|create|update|delete --project $PID` (and `-d` JSON for create/update), or generic `aerekos call`.

## Quick start

```bash
cd worker/security_manager
cp .env_example .env   # optional
npm install            # Node 20+
npm start
# curl http://localhost:3108/health
```

## Environment

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | `3108` | Listen port |
| `DATABASE_PATH` | `data/security_manager.db` | SQLite file |
| `SKIP_SERVICE_REGISTRATION` | unset | `true` in tests |
| `CONDUCTOR_URL` | unset | Optional auto-registration |

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | prod guard + `assertNoSkipFakes` wiring |
| Integration | `npm run test:integration` | health/ready/info/metrics + findings CRUD + scan |
| All | `npm test` | unit + integration |
| Live e2e | needs conductor | Proxy path parked; root `e2e/catalog.js` lists CRUD |

## Related

- Conductor seed / `managerServicePorts` → `3108`
- Detectors / SIEM integration parked (see [`plan.md`](./plan.md))
- Root [`GOLDEN_PATH.md`](../../GOLDEN_PATH.md)
