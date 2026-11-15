# Backup Manager

**AWS analog:** AWS Backup · **Port:** `3134`

Project-scoped **vaults** (CRUD `/api/v1/vaults`) plus snapshot **jobs** that write into storage bucket `aerekos-backups` at `/{source}/{resource}/{timestamp}/{jobId}`. Restore replays adapters for db/storage/git/generic JSON. Live multi-region vault replication and AWS Backup control-plane parity are **out of scope** for MVP.

No production mocks — `assertNoSkipFakes()` via `createManagerApp` refuses shared skip-fake flags when `NODE_ENV=production`. Scheduler starts unless `SKIP_BACKUP_CRON=1`.

## Status

**MVP / implemented** — vaults CRUD, ensure-defaults, jobs create/list/get/restore, `/health`, `/ready`, `/api/v1/info`, `/metrics`.

**Tutorial / ServiceGuide:** none (ManagerConsole has no `CONSOLE_GUIDES` entry for `backup_manager`).

## Access

- Direct: `http://localhost:3134/...`
- Conductor proxy: `{CONDUCTOR}/api/services/backup_manager{path}` (JWT or service token)

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`) |
| `POST` | `/api/v1/ensure-defaults` | Seed default vault for `project_id` |
| `POST` | `/api/v1/vaults` | Create vault (`project_id`, `name`, …) |
| `GET` | `/api/v1/vaults` | List (`?project_id=`) |
| `GET` | `/api/v1/vaults/:id` | Get one |
| `PATCH`/`PUT` | `/api/v1/vaults/:id` | Update |
| `DELETE` | `/api/v1/vaults/:id` | Delete |
| `POST` | `/api/v1/jobs` | Run snapshot (`project_id`, `source`, `resource`, `vault`) |
| `GET` | `/api/v1/jobs` | List jobs |
| `GET` | `/api/v1/jobs/:id` | Job metadata + signed download URL |
| `POST` | `/api/v1/jobs/:id/restore` | Restore (`dest` optional) |

`source` is a manager name. Adapters (real, via `CONDUCTOR_URL` + `SERVICE_TOKEN`):

- `storage_manager` — copy objects from the named bucket
- `db_manager` — `POST /api/databases/:name/backups` and record `storage_path`
- `secrets_manager` — secret names + ciphertext only (never `reveal=1`)
- `git_manager` — git bundle/tar of the repo
- `logs_manager` / `audit_manager` — JSONL of recent events
- any other catalog manager — click-ops list as one JSON object

`key_manager` key material, auth tokens, and email/sms/slack live credentials are not dumped.

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/backup_manager.yaml`](../../docs/openapi/backup_manager.yaml). Catalog mirror: [`docs/services/backup_manager.md`](../../docs/services/backup_manager.md).

## SDK / CLI

- **SDK (Node):** generic `client.resource('backup_manager', 'vaults')` or `client.proxy('backup_manager', …)`. Jobs via proxy/`aerekos call`.
- **CLI:** `aerekos backup_manager vaults list|get|create|update|delete --project $PID` · jobs via `aerekos call backup_manager POST "/api/v1/jobs" …`

## Quick start

```bash
cd worker/backup_manager
cp .env_example .env
npm install
npm start
# curl http://localhost:3134/health
```

## Environment

See [`.env_example`](./.env_example). Set `CONDUCTOR_URL` for auto-registration with the conductor. Use `SKIP_BACKUP_CRON=1` to disable the in-process scheduler.

## Docker

Build context is the parent `worker/` directory:

```bash
docker build -f backup_manager/Dockerfile -t aerekos-backup_manager worker/
```

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | cronMatch + gitSource + prod-guard |
| Integration | `npm run test:integration` | health/ready/info + vaults CRUD + mocked jobs |
| All | `npm test` | unit + integration |
| E2E | [`tests/e2e/README.md`](./tests/e2e/README.md) | live proxy parked; root `e2e/catalog.js` |

## Related

- Conductor registration / proxy · storage_manager (`aerekos-backups`)
- Root [`GOLDEN_PATH.md`](../../GOLDEN_PATH.md)
