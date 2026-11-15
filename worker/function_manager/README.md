# function_manager

**AWS analog:** Lambda · **Port:** `3139`

Project-scoped **functions** (CRUD `/api/v1/functions`) with sync invoke, EventSource attach/detach to `queue_manager`, and an always-on poller that drains inbox queues (failures nack toward DLQ). SQLite via `aerekos-record`. No production mocks — `createManagerApp` → `assertNoSkipFakes()` refuses `SKIP_INVOKE` / related skip flags when `NODE_ENV=production`.

## Status

**MVP / implemented** — functions CRUD, invoke (`RequestResponse` / `Event`), event-sources, `ensure-defaults` (seed `hello` + inbox), `/health`, `/ready`, `/api/v1/info`, `/metrics`, `/api/v1/poll`.

**Tutorial:** none standalone. Console **FunctionManager** screen ships an in-app **ServiceGuide**.

## Access

- Direct: `http://localhost:3139/...`
- Conductor proxy: `{CONDUCTOR}/api/services/function_manager{path}` (JWT or service token)

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`) |
| `POST` | `/api/v1/ensure-defaults` | Seed default `hello` function if missing |
| `POST` | `/api/v1/functions` | Create (`project_id`, `name`, optional `trigger`, runtime, handler, …) |
| `GET` | `/api/v1/functions` | List (`?project_id=`) |
| `GET` | `/api/v1/functions/:id` | Get one |
| `PATCH` | `/api/v1/functions/:id` | Update |
| `DELETE` | `/api/v1/functions/:id` | Delete |
| `POST` | `/api/v1/functions/:id/event-sources` | Attach a queue (provision inbox+DLQ if missing) |
| `GET` | `/api/v1/functions/:id/event-sources` | List EventSource mappings |
| `DELETE` | `/api/v1/functions/:id/event-sources/:sid` | Detach a queue (does not delete it) |
| `POST` | `/api/v1/functions/:name/invoke` | Invoke (`RequestResponse` or `Event`) |
| `POST` | `/api/v1/poll` | Drain one poll cycle for the project |

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/function_manager.yaml`](../../docs/openapi/function_manager.yaml). Catalog mirror: [`docs/services/function_manager.md`](../../docs/services/function_manager.md).

## SDK / CLI

- **SDK (Node):** `client.functions.deploy|invoke|attachQueue|detachQueue`. Generic CRUD: `client.resource('function_manager', 'functions')`.
- **CLI:** `aerekos function_manager functions list|get|create|update|delete --project $PID` (and `-d` JSON for create/update). Invoke/event-sources via SDK or `aerekos call` / curl.

## Quick start

```bash
cd worker/function_manager
npm install   # use Node 20 (.nvmrc)
npm start
# curl http://localhost:3139/health
```

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | Poller ack rule (HTTP 200 + `result.error` is failure) |
| Integration | `npm run test:integration` | health/ready/info, CRUD, invoke (`SKIP_INVOKE` in test setup) |
| All | `npm test` | unit + integration |
| E2E | [`tests/e2e/README.md`](./tests/e2e/README.md) | proxy + root `e2e/catalog.js` / `e2e/wave-aws-parity.js` |

## Related

- Conductor registration / proxy · FunctionManager ServiceGuide
- `queue_manager` (inbox/DLQ) · `compute_manager` (image oneshot) · `storage_manager` (code zip)
- Root [`GOLDEN_PATH.md`](../../GOLDEN_PATH.md)
