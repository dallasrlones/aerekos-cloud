# Auth Manager

Optional external auth federation hooks; complements conductor JWT users.

## Status

**MVP** — project-scoped CRUD on a SQLite-backed entity, plus `/health`, `/ready`, `/api/v1/info`, and `/metrics`. See [`../MANAGER_SERVICES.md`](../MANAGER_SERVICES.md) for the exact route this manager exposes. Live provider integration (OIDC client_secret, etc.) belongs in [`secrets_manager`](../secrets_manager/) — see [`plan.md`](./plan.md) for follow-ups.

## Quick start (local)

```bash
cd worker/auth_manager
cp .env_example .env
npm install
npm run dev
# curl http://localhost:3116/health
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
| GET | /api/v1/info | Metadata (`status: "active"` — see live `/api/v1/info`) |

## Related services

- **Conductor** — routing, registry, auth
- **Worker** — container lifecycle
- See root [`plan.md`](../../plan.md) for full platform map
