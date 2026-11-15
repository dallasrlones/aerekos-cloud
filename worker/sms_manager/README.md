# sms_manager

**AWS analog:** SNS SMS · **Port:** `3114`

Project-scoped **SMS message** rows (`to_number`, `body`, `status`) with optional `POST /api/v1/messages/:id/send`. SQLite via `aerekos-record`. Live Twilio only when secrets exist; otherwise queue-only. `SKIP_SMS` / `SKIP_OUTBOUND` are test/dev only (refused in production via `assertNoSkipFakes`).

## Status / honesty

| Claim | Reality |
|-------|---------|
| CRUD | Real SQLite messages via `/api/v1/messages` |
| Send | `POST .../messages/:id/send` uses `shared/outboundSend` — Twilio when keys present |
| Without Twilio keys | Queue-only (`skipped` / `reason: queue_only`) |
| SNS SMS parity | Naming analog only — no AWS SNS SMS client |
| Prod mocks | No `SKIP_SMS` / `SKIP_OUTBOUND` / skip-fakes when `NODE_ENV=production` |
| Tutorial | **None** standalone — console generic **ManagerConsole** (no `CONSOLE_GUIDES` entry) |

## Access

- Direct: `http://localhost:3114/...`
- Conductor proxy: `{CONDUCTOR}/api/services/sms_manager{path}` (JWT or service token)

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`) |
| `POST` | `/api/v1/messages` | Create (`project_id`, `name`, …) |
| `GET` | `/api/v1/messages` | List (`?project_id=`) |
| `GET` | `/api/v1/messages/:id` | Get one |
| `PATCH`/`PUT` | `/api/v1/messages/:id` | Update |
| `POST` | `/api/v1/messages/:id/send` | Attempt SMS send / stay queued |
| `DELETE` | `/api/v1/messages/:id` | Delete |

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/sms_manager.yaml`](../../docs/openapi/sms_manager.yaml). Catalog: [`docs/services/sms_manager.md`](../../docs/services/sms_manager.md).

## SDK / CLI

- **SDK (Node):** `client.resource('sms_manager', 'messages')` (create/list/get/update/delete). Send via SDK/`aerekos call` / curl.
- **CLI:** `aerekos sms_manager messages list|get|create|update|delete --project $PID` (and `-d` JSON for create/update), or generic `aerekos call`.

## Quick start

```bash
cd worker/sms_manager
cp .env_example .env   # optional
npm install            # Node 20+
npm start
# curl http://localhost:3114/health
```

## Environment

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | `3114` | Listen port |
| `DATABASE_PATH` | `data/sms_manager.db` | SQLite file |
| `SKIP_SERVICE_REGISTRATION` | unset | `true` in tests |
| `SKIP_SMS` / `SKIP_OUTBOUND` | unset | Force queue-only in tests/dev |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM` | unset | Required for live send |
| `CONDUCTOR_URL` | unset | Optional auto-registration |

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | prod guard + `assertNoSkipFakes` wiring |
| Integration | `npm run test:integration` | health/ready/info + CRUD + send (SKIP_SMS) |
| All | `npm test` | unit + integration |
| Live e2e | needs conductor | Proxy path parked; root `e2e/catalog.js` lists CRUD |

## Related

- Conductor seed / `managerServicePorts` → `3114`
- Twilio secrets required for live send (catalog status `needs-keys`)
- Root [`GOLDEN_PATH.md`](../../GOLDEN_PATH.md)
