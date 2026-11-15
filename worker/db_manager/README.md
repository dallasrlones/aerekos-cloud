# Database Manager

Project-scoped **database instances** on the worker: create metadata records, run engine containers (PostgreSQL, MongoDB, Redis, Neo4j, Elasticsearch) via **dockerode**, plus embedded **sqlite3** / **lancedb** engines. Credentials are encrypted with **`key_manager`**. Control-plane state is **SQLite** (`aerekos-record`).

## Status

**MVP+ / GA (core)** — CRUD, Docker lifecycle, encryption, backups/restore, health, volumes; LanceDB vector upsert/search and constrained memory SQL on sqlite3. Gated live-engine tests behind `DB_MANAGER_INTEGRATION=1`. See [`plan.md`](./plan.md) for backlog.

## Default port

**`3004`** (host and container in default seed config). Conductor and [`MANAGER_SERVICES.md`](../MANAGER_SERVICES.md) use the same.

## Dependencies

- **`key_manager`** — **Required** in production to encrypt connection strings and secrets.
- **Worker Docker socket** — Engine containers (non-sqlite3/lancedb) are created on the same host as the worker.
- **Conductor** — Registration, routing, optional proxy to this API.

### No production mocks

`MOCK_KEY_MANAGER=true` is **dev/tests only**. Startup **exits** if `NODE_ENV=production` and `MOCK_KEY_MANAGER=true`. Do not set the mock on prod compose/fleet paths.

## Quick start (local)

```bash
cd worker/db_manager
cp .env_example .env
# Set CONDUCTOR_URL; keep MOCK_KEY_MANAGER=false unless local-only without key_manager
npm install   # Node 20 per repo .nvmrc
npm run dev
# curl http://localhost:3004/health
```

## API (service direct)

`project_id` is required for project-scoped operations (**query param only** — do not put `project_id` in the JSON create body).

| Area | Base path | Notes |
|------|-----------|--------|
| Info | `GET /api/info` | Service metadata (unauthenticated) |
| Databases | `POST/GET/DELETE /api/databases` | Create/list/get/delete; engines: `postgresql`, `mongodb`, `neo4j`, `elasticsearch`, `redis`, `sqlite3`, `lancedb` |
| Lifecycle | `POST /:name/start\|stop\|restart` | Docker engines |
| Connection | `GET /:name/connection` | Decrypted connection info |
| Health | `GET /:name/health` | Instance health |
| Volumes | `GET /:name/volumes` | Volume / mount metadata |
| Backups | `POST /:name/backups`, `POST /:name/backups/:id/restore` | See [`BACKUP_RESTORE.md`](./BACKUP_RESTORE.md) |
| Vectors | `POST /:name/vectors/upsert\|search`, `DELETE /:name/vectors` | **lancedb** only |
| Memory SQL | `POST /:name/memory/sql` | Constrained SQL on **sqlite3** memory tables |
| Liveness | `GET /health`, `GET /ready` | `ready` checks **key_manager** via conductor unless `MOCK_KEY_MANAGER` |
| Metrics | `GET /metrics` | Prometheus text (shared helper) |

**Via conductor (dashboard / clients):** paths are under  
`/api/services/db_manager/api/...` → proxied to this service’s `/api/...` (see [`GOLDEN_PATH.md`](../../GOLDEN_PATH.md)).

Path docs: [`docs/services/db_manager.md`](../../docs/services/db_manager.md).  
OpenAPI (catalog-generated pack): [`docs/openapi/ga-managers.generated.yaml`](../../docs/openapi/ga-managers.generated.yaml) — regenerate with `node scripts/oss/gen-openapi-from-catalog.mjs`.

## SDK / CLI

- **SDK:** `client.db` is a `ThinProxyApi` for `db_manager`, or `client.proxy('db_manager', { method, path, projectId, body })` / `client.svc.db_manager`.
- **CLI:** `aerekos call db_manager POST "/api/databases?project_id=$PID" --data '{"name":"demo","type":"sqlite3"}'` (generic call; no dedicated `aerekos db` subcommand required for closeout).

## Tutorial / ServiceGuide

Console **DatabaseManager** ships a **ServiceGuide** (`conductor/app/screens/DatabaseManager`). There is **no** standalone `docs/tutorials/db_manager*` walkthrough — use ServiceGuide + this README + [`docs/services/db_manager.md`](../../docs/services/db_manager.md).

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
| Default | `npm test` | Unit + API integration (mocked/embedded); Node 20 |
| DB farm | `DB_MANAGER_INTEGRATION=1 npm run test:integration` | Live Docker + engines — see [`tests/integration/databases/README.md`](./tests/integration/databases/README.md) |
| Coverage | `npm run test:coverage` | |
| E2E (fleet) | `node e2e/db-rds.js` | Icarus T39 — provision sqlite3 + list via conductor proxy (`ICARUS_C0_SKIP_LIVE=1` skips) |

## More docs (this folder)

- **[`BACKUP_RESTORE.md`](./BACKUP_RESTORE.md)** — backup/restore operations.
- **[`plan.md`](./plan.md)** — design and task checklist.
- **[`START_HERE.md`](./START_HERE.md)** — long-form agent/implementation context (optional).

## Related

- Conductor app: `DatabaseManager` screens call [`conductor/app/services/dbManagerService.js`](../../conductor/app/services/dbManagerService.js) (path prefix `db_manager/api`).
- Platform port map: [`conductor/api/config/managerServicePorts.js`](../../conductor/api/config/managerServicePorts.js).
