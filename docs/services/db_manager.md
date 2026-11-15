# db_manager — RDS

> **Core** · Implemented

Managed database control plane: provision/start/stop/restart engines (postgresql, mongodb, neo4j, elasticsearch, redis, sqlite3, lancedb), backups + restore, volumes, LanceDB vectors, constrained memory SQL.

- **Port:** `3004`
- **AWS analog:** RDS
- **Proxy base:** `/api`
- **Access:** `{VERB} {CONDUCTOR}/api/services/db_manager{path}` (JWT or service token)
- **Capabilities:** `managed-db`, `backups`, `lifecycle`, `vectors`, `memory-sql`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/info` | Service metadata |
| `GET` | `/health` | Liveness (control-plane SQLite) |
| `GET` | `/ready` | Readiness (key_manager via conductor unless MOCK_KEY_MANAGER) |
| `POST` | `/api/databases` | Provision a database (project_id query only; type required) |
| `GET` | `/api/databases` | List databases |
| `GET` | `/api/databases/:name` | Get a database (includes arn) |
| `GET` | `/api/databases/:name/connection` | Connection info |
| `POST` | `/api/databases/:name/start` | Start |
| `POST` | `/api/databases/:name/stop` | Stop |
| `POST` | `/api/databases/:name/restart` | Restart |
| `POST` | `/api/databases/:name/backups` | Create a backup |
| `POST` | `/api/databases/:name/backups/:backupId/restore` | Restore a backup |
| `GET` | `/api/databases/:name/health` | Health |
| `GET` | `/api/databases/:name/volumes` | Volume / mount metadata |
| `POST` | `/api/databases/:name/vectors/upsert` | Upsert vectors (lancedb) |
| `POST` | `/api/databases/:name/vectors/search` | Search vectors (lancedb) |
| `DELETE` | `/api/databases/:name/vectors` | Delete vectors (lancedb) |
| `POST` | `/api/databases/:name/memory/sql` | Constrained memory SQL (sqlite3) |
| `DELETE` | `/api/databases/:name` | Delete |

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PROJECT_ID` | `default` | Project this control plane serves |
| `MOCK_KEY_MANAGER` | `false` | Dev/tests only; refused when NODE_ENV=production |

## Examples

**curl**

```bash
# through the conductor proxy (JWT) — project_id is query-only; omit from JSON body
curl -s -X POST \
  "$CONDUCTOR/api/services/db_manager/api/databases?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"demo","type":"sqlite3"}'
```

**SDK (Node)**

```js
// client.db ThinProxyApi, or generic proxy / client.svc.db_manager
await client.proxy('db_manager', {
  method: 'POST',
  path: '/api/databases',
  projectId: PID,
  body: { name: 'demo', type: 'sqlite3' },
});
```

**CLI**

```bash
aerekos call db_manager POST "/api/databases?project_id=$PID" --data '{"name":"demo","type":"sqlite3"}'
```

**Tutorial:** none standalone — console DatabaseManager ServiceGuide + worker README.

**E2E:** `node e2e/db-rds.js` (Icarus T39). **Mocks:** `MOCK_KEY_MANAGER` refused when `NODE_ENV=production`.

---

_Generated from `docs/catalog.js` (examples hand-tuned for query-only `project_id`)._