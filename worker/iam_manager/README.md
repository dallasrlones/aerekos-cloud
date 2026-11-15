# IAM Manager

Project-scoped **roles**, **JSON allow/deny policies**, **role↔policy bindings**, and **`POST /api/v1/evaluate`**. This service stores and evaluates authZ documents. Conductor edge enforcement calls evaluate when `IAM_ENFORCE_PROXY=true` (human JWT); app credentials use ARN/scope separately.

## Status

**Implemented (MVP+)** — SQLite via `aerekos-record` (`IamRole`, `IamPolicy`, `IamRolePolicyBinding`); REST under `/api/v1/*`. No production mocks. See [`plan.md`](./plan.md) for backlog (metrics polish, rate limits, dedicated CLI verbs).

## Quick start (local)

```bash
cd worker/iam_manager
cp .env_example .env
npm install
npm run dev
# curl http://localhost:3106/health
```

## Environment

See [`.env_example`](./.env_example). Set `CONDUCTOR_URL` for auto-registration. No `MOCK_*` env vars — SQLite is the real store in all environments.

## API

All CRUD/evaluate calls require **`project_id`** (query, body, or `X-Project-Id`).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness (SQLite) |
| GET | `/ready` | Readiness |
| GET | `/api/v1/info` | Service metadata (`status: "active"`) |
| POST, GET, GET `/:id`, PATCH, DELETE | `/api/v1/policies` | Policies CRUD |
| POST, GET, GET `/:id`, PATCH, DELETE | `/api/v1/roles` | Roles CRUD |
| GET, POST, DELETE | `/api/v1/roles/:roleId/policies` … | List / attach / detach |
| POST | `/api/v1/evaluate` | Allow/deny for action + resource (optional role) |

**OpenAPI:** [`api/openapi.yaml`](./api/openapi.yaml)

**Via conductor:** `{VERB} {CONDUCTOR}/api/services/iam_manager{path}` (JWT or service token).

## SDK / CLI

No dedicated typed SDK client or `aerekos iam …` verbs yet — use the generic proxy:

```js
await client.proxy('iam_manager', {
  method: 'POST',
  path: '/api/v1/evaluate',
  projectId: PID,
  body: { project_id: PID, role_name: 'reader', action: 'storage:GetObject', resource_arn: ARN },
});
```

```bash
aerekos call iam_manager POST "/api/v1/evaluate" --project $PID \
  --data '{"project_id":"'"$PID"'","role_name":"reader","action":"storage:GetObject","resource":"'"$ARN"'"}'
```

Catalog entry: `aerekos-sdk/managers.generated.js` → `iam_manager`.

## Tutorial / ServiceGuide

**Tutorial: none** (no standalone tutorial under `docs/tutorials`). Console **ServiceGuide** copy lives on the generic ManagerConsole route (`CONSOLE_GUIDES.iam_manager` in `conductor/app/screens/ManagerConsole/ManagerConsole.jsx`).

## Docker

Build context is the parent `worker/` directory:

```bash
docker compose -f docker-compose.yml up --build
```

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | `IamService` (mocked stores) |
| Integration | `npm run test:integration` | Health + CRUD + evaluate (supertest) |
| E2E (local) | `npm run test:e2e` | Full lifecycle in `tests/e2e/iamFlow.test.js` |
| E2E (live) | repo `e2e/tier6-app-access.js`, `e2e/wave2-tunnel-compute-iam.js` | Conductor proxy |

## Related

- Conductor `requireIamAccess` — optional proxy gate via evaluate
- Docs: [`docs/services/iam_manager.md`](../../docs/services/iam_manager.md), [`docs/architecture/identity.md`](../../docs/architecture/identity.md)
