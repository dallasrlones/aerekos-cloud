# db_manager — backup and restore

`db_manager` provisions and tracks **logical databases** (metadata in SQLite/Postgres, depending on your deployment). Backups are **two layers**: the control-plane DB that stores your inventory, and each **data plane** engine you run (e.g. Postgres, Redis) on workers.

## 1. Control plane (db_manager + conductor state)

- **SQLite** (default local dev): stop the `db_manager` process (or use an online backup tool that supports SQLite WAL) and copy the file referenced by `DATABASE_PATH` in `db_manager`’s environment.
- **Schedule**: copy the DB file nightly or use **Litestream** / a volume snapshot if the DB file lives on a ZFS/EBS volume.
- **Restore**: stop the service, replace the file, start again. Verify with `/health` and a sample `GET` that lists known databases.

## 2. User databases created through db_manager

For each **engine** you support (PostgreSQL, MySQL, MongoDB, etc.):

| Engine | Backup idea | Restore idea |
|--------|-------------|--------------|
| **PostgreSQL** | `pg_dump` / `pg_basebackup` / managed snapshots | `pg_restore` or replay WAL per vendor docs |
| **MySQL / MariaDB** | `mysqldump` or Percona XtraBackup | Import dump or restore from snapshot |
| **MongoDB** | `mongodump` / Ops Manager | `mongorestore` |
| **Redis** | RDB + AOF (if persistence on) / DR replication | Point-in-time from snapshot + replay policy |
| **SQLite** (per-tenant on disk) | File copy while quiesced or `VACUUM INTO` | Replace file, fix permissions |

Keep **project_id** and **connection id** in `db_manager` consistent: after a restore, URLs and credentials stored in the control plane should still match the restored cluster (or re-issue credentials in your app path).

## 3. End-to-end disaster recovery (recommended practice)

1. **Backup** control-plane DB + each engine on its own schedule.
2. **Document** RPO/RTO per project tier (e.g. dev: daily; prod: continuous).
3. **Test** a restore to a **staging** volume at least once per release where you change persistence.

## 4. aerekos-cloud–specific note

- Workers that host database containers should use **named volumes** or **host paths** you can snapshot at the storage layer; `db_manager`’s API is the **catalog** of what exists, not a substitute for engine-native backup.
- If you add **cross-region** replicas later, treat backup as **per-region** first, then replication.

## Tests (CI vs full stack)

- **Default:** `cd worker/db_manager && npm test` — unit + API route tests (no live conductor).
- **Engine / Docker integration:** `npm run test:integration` (requires conductor, images, etc.). See `tests/integration/databases/README.md`.

## See also

- `worker/db_manager/START_HERE.md` — how the service is structured.
- `GOLDEN_PATH.md` (repo root) — control-plane vs worker roles.
