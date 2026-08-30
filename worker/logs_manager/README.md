# Logs Manager

Ingest, store, and query **append-only** log events per project. Structured **`context`** JSON is optional. Used for platform observability; pair with `GET /metrics` on the same process.

## Status

**MVP** — SQLite `LogEvent`, `POST/GET /api/v1/logs*`, `GET /metrics` (shared Prometheus helper). See [`plan.md`](./plan.md).

## Quick start (local)

```bash
cd worker/logs_manager
cp .env_example .env
npm install
npm run dev
# curl http://localhost:3104/health
```

## Environment

See [`.env_example`](./.env_example). `DATABASE_PATH` for SQLite. Set `CONDUCTOR_URL` for auto-registration with the conductor.

## API

Scoped by **`project_id`** (query or body as documented in routes).

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Liveness (SQLite) |
| GET | /ready | Readiness |
| GET | /metrics | Prometheus text |
| GET | /api/v1/info | Service metadata (`status: "active"`) |
| POST | /api/v1/logs | Ingest: level, message, optional `context` |
| GET | /api/v1/logs?project_id=&level=&since=&limit= | Query |
| GET | /api/v1/logs/:id?project_id= | Get one |

Levels: `debug` \| `info` \| `warn` \| `error` \| `fatal` (see `plan.md` for limits).

## Docker

Build context is the parent `worker/` directory:

```bash
docker compose -f docker-compose.yml up --build
```

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Integration | `npm run test:integration` | supertest |
| E2E | `tests/e2e/README.md` | Manual + optional CI |

## Related services

- **Conductor** — routing, registry, auth
- **Worker** — optional `POST` from services
- See root [`plan.md`](../../plan.md) for full platform map
