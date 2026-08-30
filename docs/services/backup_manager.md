# backup_manager — AWS Backup

> **Storage & Content** · Implemented

Backup vaults and snapshot jobs into the aerekos-backups bucket. Restore db/storage/git/generic JSON.

- **Port:** `3134`
- **AWS analog:** AWS Backup
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/backup_manager{path}` (JWT or service token)
- **Capabilities:** `backup`, `restore`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/vaults` | Create a vault ({ project_id, name, ... }) |
| `GET` | `/api/v1/vaults` | List vaults (?project_id=) |
| `GET` | `/api/v1/vaults/:id` | Get one vault |
| `PATCH` | `/api/v1/vaults/:id` | Update a vault |
| `DELETE` | `/api/v1/vaults/:id` | Delete a vault |
| `POST` | `/api/v1/jobs` | Run a backup job { project_id, source, resource, vault } |
| `GET` | `/api/v1/jobs` | List backup jobs |
| `GET` | `/api/v1/jobs/:id` | Job metadata + signed download URL |
| `POST` | `/api/v1/jobs/:id/restore` | Restore a snapshot |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/backup_manager/api/v1/vaults?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
const r = client.resource('backup_manager', 'vaults');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos backup_manager vaults create --project $PID --data '{"name":"demo"}'
aerekos backup_manager vaults list --project $PID
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._
