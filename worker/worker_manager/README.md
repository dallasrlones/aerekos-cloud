# Worker Manager

Fleet-level worker operations beyond single-node worker agent (bulk actions, labels).

## Status

**MVP** — project-scoped CRUD on a SQLite-backed annotation entity, plus `/health`, `/ready`, `/api/v1/info`, and `/metrics`. See [`../MANAGER_SERVICES.md`](../MANAGER_SERVICES.md) for the exact route this manager exposes. The worker **agent** itself is the separate `worker/` package (the agent-of-record); this is for **fleet labels / metadata**.

## Quick start (local)

```bash
cd worker/worker_manager
cp .env_example .env
npm install
npm run dev
# curl http://localhost:3128/health
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
| Unit | `npm run test:unit` | Extend `tests/unit/` |
| Integration | `npm run test:integration` | supertest against exported app |
| Coverage | `npm run test:coverage` | |
| E2E | `tests/e2e/README.md` | Manual + optional CI |

## API (skeleton only)

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Liveness |
| GET | /ready | Readiness |
| GET | /api/v1/info | Metadata (`status: "stub"` until product API exists) |

## Related services

- **Conductor** — routing, registry, auth
- **Worker** — container lifecycle
- See root [`plan.md`](../../plan.md) for full platform map
