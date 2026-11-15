# push_manager

**AWS analog:** SNS mobile · **Port:** `3153`

Project-scoped **push subscriptions** (CRUD `/api/v1/subscriptions`) plus `POST /api/v1/ensure-defaults` (seeds `web` when empty) and `POST /api/v1/send` (FCM when `FCM_SERVER_KEY` + device token exist; otherwise queue-only). SQLite via `aerekos-record`. `SKIP_PUSH` / `SKIP_OUTBOUND` are test/dev only (refused in production via `assertNoSkipFakes`).

## Status / honesty

| Claim | Reality |
|-------|---------|
| CRUD | Real SQLite subscriptions via `/api/v1/subscriptions` |
| Send | `POST /api/v1/send` uses `shared/outboundSend.sendPush` — FCM when key + token present |
| Without FCM key | Queue-only (`skipped` / `reason: queue_only`) |
| SNS mobile parity | Naming analog only — no AWS SNS client |
| Prod mocks | No `SKIP_PUSH` / `SKIP_OUTBOUND` / skip-fakes when `NODE_ENV=production` |
| Tutorial | **None** standalone — console generic **ManagerConsole** (no `CONSOLE_GUIDES` entry) |

**Parked:** live conductor proxy e2e; live FCM delivery needs `FCM_SERVER_KEY` + device token (`needs-keys`).

## Access

- Direct: `http://localhost:3153/...`
- Conductor proxy: `{CONDUCTOR}/api/services/push_manager{path}` (JWT or service token)

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`) |
| `POST` | `/api/v1/ensure-defaults` | Seed default subscription if missing |
| `POST` | `/api/v1/send` | Attempt FCM send / stay queued |
| `POST` | `/api/v1/subscriptions` | Create (`project_id`, `name`, optional `endpoint` / `kind`) |
| `GET` | `/api/v1/subscriptions` | List (`?project_id=`) |
| `GET` | `/api/v1/subscriptions/:id` | Get one |
| `PATCH`/`PUT` | `/api/v1/subscriptions/:id` | Update |
| `DELETE` | `/api/v1/subscriptions/:id` | Delete |

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/push_manager.yaml`](../../docs/openapi/push_manager.yaml). Catalog: [`docs/services/push_manager.md`](../../docs/services/push_manager.md).

## SDK / CLI

- **SDK (Node):** `client.resource('push_manager', 'subscriptions')` (create/list/get/update/delete). Send via SDK/`aerekos call` / curl.
- **CLI:** `aerekos push_manager subscriptions list|get|create|update|delete --project $PID` (and `-d` JSON for create/update), or generic `aerekos call`.

## Quick start

```bash
cd worker/push_manager
cp .env_example .env   # optional
npm install            # Node 20+
npm start
# curl http://localhost:3153/health
```

## Environment

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | `3153` | Listen port |
| `DATABASE_PATH` | `data/push_manager.db` | SQLite file |
| `SKIP_SERVICE_REGISTRATION` | unset | `true` in tests |
| `SKIP_PUSH` / `SKIP_OUTBOUND` | unset | Force queue-only in tests/dev |
| `FCM_SERVER_KEY` | unset | Required for live send |
| `CONDUCTOR_URL` | unset | Optional auto-registration |

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | prod guard + `assertNoSkipFakes` wiring |
| Integration | `npm run test:integration` | health/ready/info + CRUD + send (SKIP_PUSH) |
| All | `npm test` | unit + integration |
| Live e2e | needs conductor | Proxy path parked; FCM keys for live send |

## Related

- Conductor seed / `managerServicePorts` → `3153`
- FCM secret required for live send (catalog status `needs-keys`)
- Root [`GOLDEN_PATH.md`](../../GOLDEN_PATH.md)
