# event_manager

**AWS analog:** EventBridge · **Port:** `3132`

Project-scoped **event buses** (CRUD `/api/v1/buses`), **rules** (`/api/v1/rules`), and **put events** (`POST /api/v1/events` → 202 with deliveries). `POST /api/v1/ensure-defaults` seeds `default` and `aerekos.fleet` buses. SQLite via `aerekos-record`.

`email` / `sms` / `slack` rule targets are always recorded as skipped (`outbound_disabled`) — this service does not send those channels. `push` skips when `SKIP_OUTBOUND` is set. Queue / function / websocket / webhook / iot targets HTTP to conductor services (or absolute webhook URL). `SKIP_OUTBOUND` is test/dev only (refused in production via `assertNoSkipFakes` + `createManagerApp`).

## Status / honesty

| Claim | Reality |
|-------|---------|
| Buses CRUD | Real SQLite via `/api/v1/buses` |
| Rules | Create/list (`bus_id` / `bus` name); match on source + type_pattern |
| Put event | `POST /api/v1/events` → 202 `{ event, deliveries }` |
| EventBridge parity | Naming analog only — no AWS EventBridge client |
| Prod mocks | No `SKIP_OUTBOUND` / skip-fakes when `NODE_ENV=production` |
| Tutorial | **None** standalone — console generic **ManagerConsole** (no `CONSOLE_GUIDES` entry) |

## Access

- Direct: `http://localhost:3132/...`
- Conductor proxy: `{CONDUCTOR}/api/services/event_manager{path}` (JWT or service token)

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`) |
| `POST` | `/api/v1/ensure-defaults` | Seed `default` + `aerekos.fleet` buses |
| `POST` | `/api/v1/events` | Put event (`project_id`, `type`, …) → 202 |
| `POST` | `/api/v1/rules` | Create rule |
| `GET` | `/api/v1/rules` | List rules (`?project_id=` / `bus_id`) |
| `POST` | `/api/v1/buses` | Create (`project_id`, `name`, …) |
| `GET` | `/api/v1/buses` | List (`?project_id=`) |
| `GET` | `/api/v1/buses/:id` | Get one |
| `PATCH`/`PUT` | `/api/v1/buses/:id` | Update |
| `DELETE` | `/api/v1/buses/:id` | Delete |

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/event_manager.yaml`](../../docs/openapi/event_manager.yaml). Catalog: [`docs/services/event_manager.md`](../../docs/services/event_manager.md).

## SDK / CLI

- **SDK (Node):** `client.resource('event_manager', 'buses')` (create/list/get/update/delete). Events/rules via SDK/`aerekos call` / curl.
- **CLI:** `aerekos event_manager buses list|get|create|update|delete --project $PID` (and `-d` JSON), or generic `aerekos call`.

## Quick start

```bash
cd worker/event_manager
cp .env_example .env   # optional
npm install            # Node 20+
npm start
# curl http://localhost:3132/health
```

## Environment

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | `3132` | Listen port |
| `DATABASE_PATH` | `data/event_manager.db` | SQLite file |
| `SKIP_SERVICE_REGISTRATION` | unset | `true` in tests |
| `SKIP_OUTBOUND` | unset | Skip push delivery in tests/dev only |
| `CONDUCTOR_URL` | unset | Optional auto-registration + fan-out base |
| `CONDUCTOR_TOKEN` / `SERVICE_TOKEN` | unset | Auth for fan-out HTTP |

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | prod guard + `assertNoSkipFakes` / `SKIP_OUTBOUND` wiring |
| Integration | `npm run test:integration` | health/ready/info + CRUD + rules/events (`SKIP_OUTBOUND`) |
| All | `npm test` | unit + integration |
| Live e2e | needs conductor | Proxy path parked; root `e2e/catalog.js` lists CRUD |

## Related

- Conductor seed / `managerServicePorts` → `3132`
- Fan-out to queue / function / websocket / iot managers when live
- Root [`GOLDEN_PATH.md`](../../GOLDEN_PATH.md)
