# Database Manager

Project-scoped **database instances** on the worker: create metadata records, run engine containers (PostgreSQL, MongoDB, Redis, Neo4j, Elasticsearch) via **dockerode**, encrypt credentials with **`key_manager`**, and support backup/restore flows. Control-plane state is **SQLite** (`aerekos-record`).

## Status

**MVP+** — CRUD, Docker lifecycle, encryption, health; gated integration tests for live engines. See [`plan.md`](./plan.md) for details and backlog.

## Default port

**`3004`** (host and container in default seed config). Conductor and [`MANAGER_SERVICES.md`](../MANAGER_SERVICES.md) use the same.

## Dependencies

- **`key_manager`** — **Required** in production to encrypt connection strings and secrets (`MOCK_KEY_MANAGER=true` only for dev/tests).
- **Worker Docker socket** — Engine containers are created on the same host as the worker.
- **Conductor** — Registration, routing, optional proxy to this API.

## Quick start (local)

```bash
cd worker/db_manager
cp .env_example .env
# Set CONDUCTOR_URL, and key_manager / MOCK_KEY_MANAGER per .env_example
npm install
npm run dev
# curl http://localhost:3004/health
```

## API (service direct)

`project_id` is required for project-scoped operations (query, body, or `X-Project-Id`).

| Area | Base path | Notes |
|------|-----------|--------|
| Databases | `POST/GET/DELETE /api/databases` | Create/list/get/delete; connection string; `POST /:name/start|stop|restart`; `GET /:name/health` |
| Backups | `POST /:name/backups`, `POST /:name/backups/:id/restore` | See [`BACKUP_RESTORE.md`](./BACKUP_RESTORE.md) |
| Liveness | `GET /health`, `GET /ready` | `ready` checks **key_manager** via conductor (unless `MOCK_KEY_MANAGER`) |
| Metrics | `GET /metrics` | Prometheus text (shared helper) |

**Via conductor (dashboard / clients):** paths are under  
`/api/services/db_manager/api/...` → proxied to this service’s `/api/...` (see [`GOLDEN_PATH.md`](../../GOLDEN_PATH.md)).

## Environment

See [`.env_example`](./.env_example) — `PORT`, `KEY_MANAGER_URL` / `MOCK_KEY_MANAGER`, `DATABASE_PATH`, `WORKER_URL`, backup-related vars.

## Docker

Build context is the parent `worker/` directory:

```bash
docker compose -f docker-compose.yml up --build
```

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Default | `npm test` | Unit + API integration (mocked/embedded) |
| DB farm | `DB_MANAGER_INTEGRATION=1 npm run test:integration` | Live Docker + engines — see [`tests/integration/databases/README.md`](./tests/integration/databases/README.md) |
| Coverage | `npm run test:coverage` | |

## More docs (this folder)

- **[`BACKUP_RESTORE.md`](./BACKUP_RESTORE.md)** — backup/restore operations.
- **[`plan.md`](./plan.md)** — design and task checklist.
- **[`START_HERE.md`](./START_HERE.md)** — long-form agent/implementation context (optional).

## Related

- Conductor app: `DatabaseManager` screens call [`conductor/app/services/dbManagerService.js`](../../conductor/app/services/dbManagerService.js) (path prefix `db_manager/api`).
- Platform port map: [`conductor/api/config/managerServicePorts.js`](../../conductor/api/config/managerServicePorts.js).
