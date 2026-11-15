# CI/CD Manager

**AWS analog:** CodePipeline · **Port:** `3119`

Project-scoped **pipelines** (CRUD `/api/v1/pipelines`) with `POST …/run` (test / deploy / build-image / apply-stack / fleet) and `POST /api/v1/pipelines/run-for-repo` for git push matching. SQLite via `aerekos-record`. Deploy/build proxies to `compute_manager`; workflow YAML / checks via `git_manager`. Live CI runners executing arbitrary jobs are **out of scope** for MVP.

No production mocks — `assertNoSkipFakes()` on boot refuses shared skip-fake flags when `NODE_ENV=production`.

## Status

**MVP / implemented** — pipelines CRUD, run actions, run-for-repo, `/health`, `/ready`, `/api/v1/info`, `/metrics`.

**Tutorial:** none standalone. Console **CicdManager** screen (no in-app ServiceGuide).

## Access

- Direct: `http://localhost:3119/...`
- Conductor proxy: `{CONDUCTOR}/api/services/cicd_manager{path}` (JWT or service token)

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`) |
| `POST` | `/api/v1/pipelines` | Create (`project_id`, `name`, …) |
| `GET` | `/api/v1/pipelines` | List (`?project_id=` · optional `environment`) |
| `GET` | `/api/v1/pipelines/:id` | Get one |
| `PATCH`/`PUT` | `/api/v1/pipelines/:id` | Update (e.g. link `target_container_id`) |
| `DELETE` | `/api/v1/pipelines/:id` | Delete |
| `POST` | `/api/v1/pipelines/:id/run` | Run (`action`: test / deploy / …) |
| `POST` | `/api/v1/pipelines/run-for-repo` | Match + run for a repo push |

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/cicd_manager.yaml`](../../docs/openapi/cicd_manager.yaml). Catalog mirror: [`docs/services/cicd_manager.md`](../../docs/services/cicd_manager.md).

## SDK / CLI

- **SDK (Node):** generic `client.resource('cicd_manager', 'pipelines')` or `client.proxy('cicd_manager', …)`. No typed `client.cicd` helper.
- **CLI:** `aerekos cicd_manager pipelines list|get|create|update|delete --project $PID` · run via `aerekos call cicd_manager POST "/api/v1/pipelines/:id/run" …`

## Quick start

```bash
cd worker/cicd_manager
cp .env_example .env
npm install
npm start
# curl http://localhost:3119/health
```

## Environment

See [`.env_example`](./.env_example). Set `CONDUCTOR_URL` for auto-registration with the conductor.

## Docker

Build context is the parent `worker/` directory:

```bash
docker compose -f docker-compose.yml up --build
```

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | deploy + runForRepo (mocked proxy) |
| Integration | `npm run test:integration` | health/ready/info + pipelines CRUD |
| All | `npm test` | unit + integration |
| E2E | [`tests/e2e/README.md`](./tests/e2e/README.md) | live proxy parked; root `e2e/catalog.js` |

## Related

- Conductor registration / proxy · CicdManager console screen
- `compute_manager` (build / replace-image) · `git_manager` (workflow blob / checks)
- Root [`GOLDEN_PATH.md`](../../GOLDEN_PATH.md)
