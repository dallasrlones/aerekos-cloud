# Self-host a data center

One **conductor primary** + **N workers**. Never two live primaries on the same SQLite file.

## Placement

- Primary: durable disk, `DATABASE_PATH` → `conductor/data/conductor.db`
- Workers: prod / dev / orin / later racks. Same registration token (or per-device after overlap rotate).
- Public: Cloudflare `cloud` / `cloudapi`. Private: Headscale `*.aerekos.internal`

## Copy off-box

- WAL on. Nightly `backup_manager` jobs into `aerekos-backups`.
- Optional continuous copy of `conductor.db` (+ `-wal` / `-shm`) to object storage.
- Shipper: `CONDUCTOR_REPLICATE_DEST=/path node conductor/scripts/replicate-sqlite.js` (interval via `CONDUCTOR_REPLICATE_INTERVAL_MS`).

## Failover drill (practice on **dev** first)

1. Confirm old primary is stopped or dead.
2. Restore latest `conductor.db` to `DATABASE_PATH` on the standby.
3. Start **one** conductor. Set `CONDUCTOR_INTERNAL_BASE_URL`.
4. Point `cloudapi` DNS / worker `CONDUCTOR_URL` if the hostname changed.
5. Smoke login + `GET /health` + one worker heartbeat.

## Do not

- Start two conductors on the same replica.
- `deploy.sh full` / `--remove-orphans` on mixed-stack prod-mini.
- Overwrite live `.env` from rsync.
- Auto-deploy aerekos-cloud by `git pull` on devices or `deploy.sh full`.
- Merge to system `aerekos-cloud` `main` publishes a release; each updater applies by its `ROLE`.

`CONDUCTOR_STORE=sqlite` this edition. Postgres + N conductors is Edition 2.
