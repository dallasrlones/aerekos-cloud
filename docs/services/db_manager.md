# db_manager — RDS

> **Core** · Implemented

Managed database control plane: provision/start/stop/restart database containers, backups + restore, health and volumes.

- **Port:** `3004`
- **AWS analog:** RDS
- **Proxy base:** `/api`
- **Access:** `{VERB} {CONDUCTOR}/api/services/db_manager{path}` (JWT or service token)
- **Capabilities:** `managed-db`, `backups`, `lifecycle`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/databases` | Provision a database |
| `GET` | `/api/databases` | List databases |
| `GET` | `/api/databases/:name` | Get a database |
| `GET` | `/api/databases/:name/connection` | Connection info |
| `POST` | `/api/databases/:name/start` | Start |
| `POST` | `/api/databases/:name/stop` | Stop |
| `POST` | `/api/databases/:name/restart` | Restart |
| `POST` | `/api/databases/:name/backups` | Create a backup |
| `POST` | `/api/databases/:name/backups/:backupId/restore` | Restore a backup |
| `GET` | `/api/databases/:name/health` | Health |
| `DELETE` | `/api/databases/:name` | Delete |

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PROJECT_ID` | `default` | Project this control plane serves |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/db_manager/api/databases?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
// generic proxy
await client.proxy('db_manager', { method: 'POST', path: '/api/databases', projectId: PID, body: { name: 'demo' } });
```

**CLI**

```bash
aerekos call db_manager POST "/api/databases" --project $PID --data '{"name":"demo"}'
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._
