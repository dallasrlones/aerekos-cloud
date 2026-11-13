# Conductor HA / DR (single-node honest edition)

**Current shape:** one conductor primary, SQLite on disk (`CONDUCTOR_STORE=sqlite`). This is **not** active/active HA. Recovery is **restore + single primary**, not automatic failover.

See also: [data-center.md](./data-center.md), `conductor/scripts/replicate-sqlite.js`, `scripts/ops/conductor-backup.sh`.

## RPO / RTO (single-node SQLite)

| Scenario | RPO (data you may lose) | RTO (time to usable API) | Notes |
|----------|-------------------------|--------------------------|-------|
| Process crash, disk intact | 0 (WAL replay) | ~1–3 min | Restart one conductor on same `DATABASE_PATH`. |
| Disk corruption / lost volume | Last **durable** off-box copy | 15–60 min (human) | Depends on backup cadence and restore drill practice. |
| Continuous replicate only (`replicate-sqlite.js`) | Up to `CONDUCTOR_REPLICATE_INTERVAL_MS` (default 60s) + in-flight WAL | 10–30 min | Stop dead primary; copy replica set to `DATABASE_PATH`; start **one** conductor. |
| Nightly `backup_manager` only | Up to 24h | 30–90 min | Acceptable for dev; tighten for prod. |
| Planned maintenance | 0 if quiesced backup | Maintenance window | `SIGTERM` conductor, cold copy db+wal+shm, start standby. |

**Honest GA posture:** treat RPO as **minutes to hours** unless replicate or backup_manager is proven in your environment. RTO is **operator-dependent** until Edition 2 (Postgres + shared SoR).

## Postgres SoR upgrade path (Edition 2 seam)

Today `conductor/api/store/ConductorStore.js` implements **SqliteStore** only; `CONDUCTOR_STORE` values other than `sqlite` throw.

Planned migration (not implemented this pass):

1. **Dual-write window (optional):** new `PostgresStore` behind the same repository interfaces; feature-flag writes.
2. **Bulk migrate:** export SQLite → import Postgres with project/worker/token FK order preserved.
3. **Cutover:** stop all conductors; run migration; set `CONDUCTOR_STORE=postgres` + `DATABASE_URL`; start **one** conductor; verify `GET /health` and worker registration.
4. **HA:** Postgres primary + standby (Patroni / managed RDS). **Still one active conductor writer** until conductor row-level locking and leader election are defined — multiple conductors reading the same SoR without leadership is unsafe for token rotation and job dispatch.

Do not run two live conductors against the same SQLite file or the same Postgres without an explicit leader lease design.

## Backup → restore drill

Practice on **dev** first. Never attach a restored DB to a running primary.

### 1. Backup (point-in-time snapshot)

```bash
# From repo root — copies conductor.db (+ wal/shm) to DEST
CONDUCTOR_BACKUP_DEST=/var/backups/conductor/$(date +%Y%m%d) \
  scripts/ops/conductor-backup.sh
```

Or continuous ship (while primary runs):

```bash
CONDUCTOR_REPLICATE_DEST=/var/backups/conductor \
  CONDUCTOR_REPLICATE_INTERVAL_MS=60000 \
  node conductor/scripts/replicate-sqlite.js
```

**API path (when `backup_manager` enabled):** UI / `backupService.run(projectId, …)` queues jobs to `backup_manager` — not a substitute for conductor SoR file backup until wired to export `DATABASE_PATH`.

### 2. Quiesce (optional, cleaner RPO)

1. Stop worker-heavy jobs if possible.
2. `curl -sf "$CONDUCTOR_URL/health"` — note `X-Request-Id`.
3. Stop the conductor process (systemd / compose stop) so SQLite checkpoints.

### 3. Restore

1. Confirm the **old** primary is stopped (no process holding `conductor.db`).
2. Copy backup files over `DATABASE_PATH` (include `-wal` / `-shm` if present from the same moment).
3. Fix ownership and permissions on the data directory.
4. Start **exactly one** conductor; set `CONDUCTOR_INTERNAL_BASE_URL` if hostname changed.
5. Update `CONDUCTOR_URL` on workers / DNS (`cloudapi`) if needed.

### 4. Verify

| Check | Command / expectation |
|-------|------------------------|
| Health | `GET /health` → 200 |
| Auth | Login or `GET /api/auth/me` with admin JWT |
| Workers | `GET /api/workers` shows last-seen heartbeats recovering |
| Icarus / managers | One proxied `GET /api/services/storage_manager/health` per pinned manager |

### 5. Rollback

If restore is bad, stop conductor, restore previous backup generation, start again. Do not merge two divergent SQLite files.

## Failure modes

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| Two primaries, divergent state | Same DB copied while both ran | Pick one timeline; restore; never merge |
| `database is locked` | Second conductor or stale WAL | Single writer; restore wal trio together |
| Workers 401 after restore | JWT secret or token table rolled back | Re-issue worker tokens if secret rotated |
| Partial restore (db only) | Missing `-wal` | Restore matching trio or run checkpoint on cold db |

## Checklist before calling it DR-ready

- [ ] Off-box backup destination tested (copy + `ls` verify).
- [ ] Restore drill completed on dev with login + one manager proxy.
- [ ] Replicate interval documented in runbook (RPO commitment).
- [ ] On-call knows: **one primary**, `DATABASE_PATH`, backup path.
