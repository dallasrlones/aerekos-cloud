# IAM Manager

Roles, policies, and role–policy bindings for **project-scoped** authorization data (IAM-shaped). **Policy evaluation** for API requests remains the conductor’s responsibility; this service stores **authZ** metadata.

## Status

**MVP** — SQLite models `IamRole`, `IamPolicy`, `IamRolePolicyBinding`; REST under `/api/v1/roles*` and `/api/v1/policies*`. Policy `document` is JSON (actions/resources, etc.). See [`plan.md`](./plan.md).

## Quick start (local)

```bash
cd worker/iam_manager
cp .env_example .env
npm install
npm run dev
# curl http://localhost:3106/health
```

## Environment

See [`.env_example`](./.env_example). Set `CONDUCTOR_URL` for auto-registration with the conductor.

## API

All calls require **`project_id`** (query, body, or `X-Project-Id`).

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Liveness (SQLite) |
| GET | /ready | Readiness |
| GET | /api/v1/info | Service metadata (`status: "active"`) |
| POST, GET, GET `/:id`, PATCH, DELETE | /api/v1/policies | Policies CRUD |
| POST, GET, GET `/:id`, PATCH, DELETE | /api/v1/roles | Roles CRUD |
| GET, POST, DELETE | /api/v1/roles/:roleId/policies, `/…/policies/:policyId` | List / attach / detach policies on a role |

## Docker

Build context is the parent `worker/` directory:

```bash
docker compose -f docker-compose.yml up --build
```

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | Extend `tests/unit/` |
| Integration | `npm run test:integration` | supertest |
| E2E | `tests/e2e/README.md` | Manual + optional CI |

## Related services

- **Conductor** — routing, registry, auth; should consume this store for RBAC over time
- **Worker** — container lifecycle
- See root [`plan.md`](../../plan.md) for full platform map
