# workflow_manager

**AWS analog:** Step Functions · **Port:** `3135`

Project-scoped **state machines** (`machines` CRUD) with `POST /api/v1/machines/:id/run`. Store is **SQLite** via `aerekos-record`. Shared `assertNoSkipFakes()` rejects skip/fake env in production.

## Status / honesty

| Claim | Reality |
|-------|---------|
| Step Functions parity | **Subset only.** Supports `steps[]` lists and a `States`/`StartAt` graph (pass, wait, choice, fail/succeed, http, queue, function). Not full ASL. |
| email / sms / slack / push | Routed through `outboundSend`; when outbound is disabled or queue-only they are **skipped** (`outbound_disabled` / `queue_only`), not delivered. |
| http steps | Relative URLs go through conductor proxy; absolute URLs use axios. `SKIP_OUTBOUND` skips http with `outbound_disabled`. |
| queue / function steps | Proxy to `queue_manager` / `function_manager` via conductor — those services must be up for live runs. |
| Prod mocks | None. Skip flags are test/dev only; bootstrap refuses them when `NODE_ENV=production`. |
| Tutorial / ServiceGuide | **None.** Console uses generic `ManagerConsole` + `ResourceCrud` (includes a **Run** action). No dedicated `CONSOLE_GUIDES` entry and no `docs/tutorials/workflow_manager*`. |

## Access

- Direct: `http://localhost:3135/...`
- Conductor proxy: `{CONDUCTOR}/api/services/workflow_manager{path}` (JWT or service token)

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`) |
| `POST` | `/api/v1/ensure-defaults` | Seed `hello` machine if project empty |
| `POST` | `/api/v1/machines` | Create (`project_id`, `name`, optional `definition`) |
| `GET` | `/api/v1/machines` | List (`?project_id=`) |
| `GET` | `/api/v1/machines/:id` | Get one |
| `PATCH` | `/api/v1/machines/:id` | Update |
| `DELETE` | `/api/v1/machines/:id` | Delete |
| `POST` | `/api/v1/machines/:id/run` | Run machine (`project_id` + optional `input`) |

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/workflow_manager.yaml`](../../docs/openapi/workflow_manager.yaml). Catalog mirror: [`docs/services/workflow_manager.md`](../../docs/services/workflow_manager.md).

## SDK / CLI

- **SDK (Node):** `client.resource('workflow_manager', 'machines')` for CRUD. Run via `client.proxy('workflow_manager', { method: 'POST', path: '/api/v1/machines/'+id+'/run', projectId, body })` (no dedicated `client.workflow` helper).
- **CLI:** `aerekos call workflow_manager POST "/api/v1/machines" --project $PID --data '{"name":"demo"}'` (generic call; no dedicated `aerekos workflow` verb required for closeout).

## Quick start

```bash
cd worker/workflow_manager
cp .env_example .env
npm install   # Node 20 (.nvmrc)
npm start
# curl http://localhost:3135/health
```

## Environment

See [`.env_example`](.env_example). Notable: `PORT` (3135), `DATABASE_PATH`, `CONDUCTOR_URL` (optional registration), `SKIP_OUTBOUND` (tests/dev).

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| All | `npm test` | Integration health + CRUD/run |
| Integration | `npm run test:integration` | supertest against exported app |
| Unit (repo) | `cd .. && npx jest tests/unit/workflowNotify.test.js` | outbound step wiring |
| Live e2e | needs conductor + optional queue/function | parked without stack |

## Related

- Conductor: `ManagerConsole` / `ResourceCrud` Run button
- Port map: [`conductor/api/config/managerServicePorts.js`](../../conductor/api/config/managerServicePorts.js)
- [`MANAGER_SERVICES.md`](../MANAGER_SERVICES.md)
