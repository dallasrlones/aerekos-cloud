# websocket_manager

**AWS analog:** API Gateway WebSocket · **Port:** `3131`

Project-scoped **channel** records (name + optional `auth_mode`) plus an in-process WSS hub at `/ws` and HTTP publish. SQLite via `aerekos-record`. Distinct from conductor Socket.IO (fleet/UI realtime) — this service is the API Gateway WebSocket analog for project apps.

## Status / honesty

| Claim | Reality |
|-------|---------|
| CRUD | Real SQLite channels via `/api/v1/channels` |
| WSS subscribe | `ws://host:3131/ws?project_id=&channel=` on the same HTTP server (`hub.attach`) |
| HTTP publish | `POST /api/v1/publish` and `POST /api/v1/channels/:id/publish` fan out to in-process subscribers |
| Multi-instance | `POST /api/v1/internal/deliver` for replica fan-out (callers must hit each replica) |
| API Gateway WebSocket | Naming analog only — no AWS API Gateway client |
| Conductor Socket.IO | Unchanged / separate (`conductor` websocket tests) |
| Prod mocks | No fake channels in prod |
| Tutorial | **None** — no dedicated ServiceGuide / `CONSOLE_GUIDES` entry |

## Access

- Direct: `http://localhost:3131/...` · WSS `ws://localhost:3131/ws?...`
- Conductor proxy: `{CONDUCTOR}/api/services/websocket_manager{path}` (JWT or service token; WSS upgrade depends on proxy support)

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`, aws `API Gateway WebSocket`) |
| `POST` | `/api/v1/ensure-defaults` | Seed default `app` channel if empty |
| `POST` | `/api/v1/channels` | Create (`project_id`, `name`, …) |
| `GET` | `/api/v1/channels` | List (`?project_id=`) |
| `GET` | `/api/v1/channels/:id` | Get one |
| `PATCH` | `/api/v1/channels/:id` | Update |
| `DELETE` | `/api/v1/channels/:id` | Delete |
| `POST` | `/api/v1/publish` | Publish by channel name (`project_id`, `channel`, `payload`) |
| `POST` | `/api/v1/channels/:id/publish` | Publish to channel by id |
| `POST` | `/api/v1/internal/deliver` | Replica deliver hook |
| WSS | `/ws` | Subscribe (`?project_id=&channel=`) |

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/websocket_manager.yaml`](../../docs/openapi/websocket_manager.yaml). Catalog: [`docs/services/websocket_manager.md`](../../docs/services/websocket_manager.md).

## SDK / CLI

- **SDK (Node):** generic CRUD `client.resource('websocket_manager', 'channels')`. No dedicated `client.websocket` helper.
- **CLI:** generic `aerekos call` / resource verbs — no dedicated `aerekos websocket` subcommand required for closeout.

```bash
aerekos call websocket_manager POST "/api/v1/channels" --project $PID --data '{"name":"demo"}'
aerekos call websocket_manager POST "/api/v1/publish" --project $PID --data '{"channel":"app","payload":{"ping":1}}'
```

## Quick start

```bash
cd worker/websocket_manager
cp .env_example .env   # optional
npm install            # Node 20+
npm start
# curl http://localhost:3131/health
```

## Environment

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | `3131` | Listen port |
| `DATABASE_PATH` | `data/websocket_manager.db` | SQLite file |
| `SKIP_SERVICE_REGISTRATION` | unset | `true` in tests |
| `CONDUCTOR_URL` | unset | Optional auto-registration |

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | ChannelHub publish/subscribe; ensureDefaults |
| Integration | `npm run test:integration` | health/ready/info + CRUD + HTTP publish |
| All | `npm test` | unit + integration |
| Live e2e | needs conductor | Proxy/WSS path parked without stack; root `e2e/catalog.js` lists CRUD |

## Related

- Conductor seed / `managerServicePorts` → `3131`
- `event_manager` / `iot_manager` may HTTP-publish into this service
- Root [`GOLDEN_PATH.md`](../../GOLDEN_PATH.md)
