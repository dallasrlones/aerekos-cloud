# notify_manager

**AWS analog:** SNS / SES / Chatbot (unified) · **Port:** `3154`

W9a home for multi-channel notify. HTTP surface owns messages + channels CRUD; send/test routes through `worker/shared/notifyFacade` + `notifyProviders`. Non-prod defaults `NOTIFY_USE_MOCK=1` (MockProvider — no paid Twilio/Slack/SMTP). Production refuses `NOTIFY_USE_MOCK` / `SKIP_OUTBOUND` via `assertNoSkipFakes`. Legacy `email_manager` / `sms_manager` / `slack_manager` / `push_manager` stay registered until Phase 2 merge.

## Status

**MVP / needs-keys** — messages + channels CRUD, ensure-defaults, providers, test, send (mock by default), `/health`, `/ready`, `/api/v1/info`, `/metrics`.

**Parked:** live conductor/proxy e2e; live provider sends (needs SMTP/Twilio/Slack/FCM secrets); Phase 2 schema/proxy aliases that retire legacy managers.

**Tutorial:** none standalone. Console uses generic **ManagerConsole** (no dedicated NotifyManager ServiceGuide).

## Access

- Direct: `http://localhost:3154/...`
- Conductor proxy: `{CONDUCTOR}/api/services/notify_manager{path}` (JWT or service token)

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`, `mock`) |
| `POST` | `/api/v1/ensure-defaults` | Seed default message if missing |
| `GET` | `/api/v1/providers` | Channel provider descriptors |
| `POST` | `/api/v1/test` | Facade test send (mock by default) |
| `POST` | `/api/v1/messages` | Create (`project_id`, `name`, channel fields) |
| `GET` | `/api/v1/messages` | List (`?project_id=`) |
| `GET` | `/api/v1/messages/:id` | Get one |
| `PATCH`/`PUT` | `/api/v1/messages/:id` | Update |
| `DELETE` | `/api/v1/messages/:id` | Delete |
| `POST` | `/api/v1/messages/:id/send` | Send via facade (mock / queue-only without keys) |
| `*` | `/api/v1/channels` | Channel config CRUD |

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/notify_manager.yaml`](../../docs/openapi/notify_manager.yaml). Catalog mirror: [`docs/services/notify_manager.md`](../../docs/services/notify_manager.md).

## SDK / CLI

- **SDK (Node):** generic `client.resource('notify_manager', 'messages')` / `client.proxy`.
- **CLI:** `aerekos notify_manager messages list|get|create|update|delete --project $PID` (and `-d` / `--data` JSON). Send/test via `aerekos call` or curl.

## Quick start

```bash
cd worker/notify_manager
npm install   # use Node 20 (.nvmrc)
npm start
# curl http://localhost:3154/health
```

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | prod skip-fake guard + bootstrap wiring |
| Integration | `npm run test:integration` | health/ready/info, CRUD, send mock, test |
| All | `npm test` | unit + integration |

Live conductor e2e is parked — see [`tests/e2e/README.md`](./tests/e2e/README.md).
