# backup_manager

**AWS analog:** AWS Backup · **Port:** 3134

CRUD `/api/v1/vaults` plus `POST /api/v1/ensure-defaults`. Snapshot jobs write objects into storage bucket `aerekos-backups` at `/{source}/{resource}/{timestamp}/{jobId}`.

## Jobs

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/jobs` | Run a snapshot (`project_id`, `source`, `resource`, `vault`) |
| `GET` | `/api/v1/jobs` | List jobs (`?project_id=`) |
| `GET` | `/api/v1/jobs/:id` | Job metadata + signed download URL for `snapshot.json` |
| `POST` | `/api/v1/jobs/:id/restore` | Restore (`dest` optional) |

`source` is a manager name. Adapters (real, via `CONDUCTOR_URL` + `SERVICE_TOKEN`):

- `storage_manager` — copy objects from the named bucket
- `db_manager` — `POST /api/databases/:name/backups` and record `storage_path`
- `secrets_manager` — secret names + ciphertext only (never `reveal=1`)
- `git_manager` — git bundle/tar of the repo
- `logs_manager` / `audit_manager` — JSONL of recent events
- any other catalog manager — click-ops list as one JSON object

`key_manager` key material, auth tokens, and email/sms/slack live credentials are not dumped.

## Run a job / restore

Through conductor:

```bash
# snapshot (resource = bucket / database / repo name)
curl -s -X POST \
  "$CONDUCTOR/api/services/backup_manager/api/v1/jobs" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'"$PID"'","source":"storage_manager","resource":"my-bucket","vault":"default"}'

# list
curl -s "$CONDUCTOR/api/services/backup_manager/api/v1/jobs?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN"

# metadata + signed download URL
curl -s "$CONDUCTOR/api/services/backup_manager/api/v1/jobs/$JOB_ID?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN"

# restore into dest (bucket / database / repo name)
curl -s -X POST \
  "$CONDUCTOR/api/services/backup_manager/api/v1/jobs/$JOB_ID/restore" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'"$PID"'","dest":"restored-bucket"}'
```

Directly on the manager (port 3134):

```bash
cd worker/backup_manager && npm test   # includes snapshot + restore round-trip
```
