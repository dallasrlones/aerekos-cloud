# webhook_manager

**AWS analog:** EventBridge / SNS (HTTP) · **Port:** `3112`

Project-scoped **outbound webhooks** (CRUD `/api/v1/webhooks`) plus `POST …/dispatch` and `GET …/deliveries`. SQLite via `aerekos-record`. Not an inbound receiver. `SKIP_OUTBOUND=1` records skipped deliveries without HTTP (tests/dev only). Production refuses `SKIP_OUTBOUND` / shared skip-fakes via `assertNoSkipFakes({ extra: ['SKIP_OUTBOUND'] })` + `createManagerApp`.

## Status

**MVP / implemented** — webhook CRUD, dispatch, delivery log, `/health`, `/ready`, `/api/v1/info`, `/metrics`.

**Parked:** live conductor proxy e2e (needs stack + enabled `webhook_manager` on a non-prod project). Live outbound HTTP needs a reachable `target_url` (use `SKIP_OUTBOUND=1` in local/CI).

**Tutorial:** none standalone. Console uses generic **ManagerConsole** for `webhook_manager` (no dedicated ServiceGuide).

## Access

- Direct: `http://localhost:3112/...`
- Conductor proxy: `{CONDUCTOR}/api/services/webhook_manager{path}` (JWT or service token)

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`) |
| `POST` | `/api/v1/webhooks` | Create (`project_id`, `name`, `target_url`, optional secret/headers) |
| `GET` | `/api/v1/webhooks` | List (`?project_id=`) |
| `GET` | `/api/v1/webhooks/:id` | Get one |
| `PATCH`/`PUT` | `/api/v1/webhooks/:id` | Update |
| `DELETE` | `/api/v1/webhooks/:id` | Delete (+ deliveries) |
| `POST` | `/api/v1/webhooks/:id/dispatch` | Send payload; `mode: skip\|live` |
| `GET` | `/api/v1/webhooks/:id/deliveries` | Delivery history |

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/webhook_manager.yaml`](../../docs/openapi/webhook_manager.yaml). Catalog mirror: [`docs/services/webhook_manager.md`](../../docs/services/webhook_manager.md).

## SDK / CLI

- **SDK (Node):** generic `client.proxy('webhook_manager', …)` / `client.resource` when wired.
- **CLI:** `aerekos call webhook_manager POST "/api/v1/webhooks" --project $PID --data '…'`

## Quick start

```bash
cd worker/webhook_manager
cp .env_example .env   # optional; set SKIP_OUTBOUND=1 for local dispatch without HTTP
npm install   # use Node 20 (.nvmrc)
npm start
# curl http://localhost:3112/health
```

## Environment

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | `3112` | Listen port |
| `DATABASE_PATH` | `data/webhook_manager.db` | SQLite file |
| `SKIP_OUTBOUND` | unset | `1`/`true` skips live HTTP (forbidden in production) |
| `WEBHOOK_HTTP_TIMEOUT_MS` | `15000` | Live dispatch timeout |
| `SKIP_SERVICE_REGISTRATION` | unset | `true` in tests |
| `CONDUCTOR_URL` | unset | Optional auto-registration |

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | prod guard + `assertNoSkipFakes` / `SKIP_OUTBOUND` wiring |
| Integration | `npm run test:integration` | health/ready/info, CRUD, dispatch under `SKIP_OUTBOUND` |
| All | `npm test` | unit + integration |
| Live e2e | parked | See [`tests/e2e/README.md`](./tests/e2e/README.md) — needs conductor |

## Related

- Conductor seed / `managerServicePorts` → `3112`
- Root [`GOLDEN_PATH.md`](../../GOLDEN_PATH.md)
