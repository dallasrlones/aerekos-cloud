# iot_manager

**AWS analog:** IoT Core · **Port:** `3140`

Project-scoped **IoT things** (CRUD `/api/v1/things`) plus `POST /api/v1/ensure-defaults` (seeds `device-1` when empty) and `POST /api/v1/publish` (marks a matching thing online and fans out via `websocket_manager`). SQLite via `aerekos-record`. No production mocks — `createManagerApp` → `assertNoSkipFakes()` refuses skip-fake flags when `NODE_ENV=production`; `SKIP_OUTBOUND` is also refused in production (extra guard).

## Status

**MVP / implemented** — things CRUD, ensure-defaults, publish (websocket fan-out), `/health`, `/ready`, `/api/v1/info`, `/metrics`.

**Parked:** live MQTT broker / device twin sync; publish without conductor+`websocket_manager` is skipped under `SKIP_OUTBOUND` in non-prod only.

**Tutorial:** none standalone. Console uses generic **ManagerConsole** for `iot_manager` (no dedicated IotManager ServiceGuide).

## Access

- Direct: `http://localhost:3140/...`
- Conductor proxy: `{CONDUCTOR}/api/services/iot_manager{path}` (JWT or service token)

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`) |
| `POST` | `/api/v1/ensure-defaults` | Seed default thing if missing |
| `POST` | `/api/v1/publish` | Publish payload (websocket fan-out; may `skipped` under `SKIP_OUTBOUND`) |
| `POST` | `/api/v1/things` | Create (`project_id`, `name`, optional `topic` / `status`) |
| `GET` | `/api/v1/things` | List (`?project_id=`) |
| `GET` | `/api/v1/things/:id` | Get one |
| `PATCH`/`PUT` | `/api/v1/things/:id` | Update |
| `DELETE` | `/api/v1/things/:id` | Delete |

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/iot_manager.yaml`](../../docs/openapi/iot_manager.yaml). Catalog mirror: [`docs/services/iot_manager.md`](../../docs/services/iot_manager.md).

## SDK / CLI

- **SDK (Node):** generic `client.resource('iot_manager', 'things')` / `client.proxy`; publish helper on SDK client.
- **CLI:** `aerekos iot_manager things list|get|create|update|delete --project $PID` (and `-d` / `--data` JSON). Publish via `aerekos call` or curl.

## Quick start

```bash
cd worker/iot_manager
npm install   # use Node 20 (.nvmrc)
npm start
# curl http://localhost:3140/health
```

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | prod skip-fake guard + bootstrap wiring |
| Integration | `npm run test:integration` | health/ready/info, CRUD, ensure-defaults, publish skip |
| All | `npm test` | unit + integration |
