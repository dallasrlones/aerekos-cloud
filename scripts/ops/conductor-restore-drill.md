# Conductor restore drill (scratch copy)

Quarterly/dev exercise: prove a **backup triplet** is readable and matches expectations **without** overwriting the live `DATABASE_PATH`. See [conductor-ha.md](../../docs/runbooks/conductor-ha.md) for full DR context.

## Preconditions

- Repo root as cwd.
- `sqlite3` CLI available.
- Live conductor may stay up; this drill only reads the source db and writes under a **scratch** directory.

## 1. Note live paths

```bash
export ROOT="$(git rev-parse --show-toplevel)"
export SRC="${DATABASE_PATH:-$ROOT/conductor/data/conductor.db}"
ls -la "$SRC" "${SRC}-wal" "${SRC}-shm" 2>/dev/null || true
```

## 2. Take a backup generation

```bash
export STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
export CONDUCTOR_BACKUP_DEST="/tmp/conductor-restore-drill/$STAMP"
"$ROOT/scripts/ops/conductor-backup.sh"
cat "$CONDUCTOR_BACKUP_DEST/BACKUP.json"
```

Expect `BACKUP.json` with `"kind":"sqlite-triplet"` and `conductor.db` present under `CONDUCTOR_BACKUP_DEST`.

## 3. Copy to scratch (never attach to a running primary)

Use a directory that is **not** `DATABASE_PATH` and not mounted by any conductor container.

```bash
export SCRATCH="/tmp/conductor-restore-scratch/$STAMP"
mkdir -p "$SCRATCH"
cp -a "$CONDUCTOR_BACKUP_DEST/"* "$SCRATCH/"
ls -la "$SCRATCH"
```

## 4. Verify SQLite integrity (offline)

```bash
sqlite3 "$SCRATCH/conductor.db" "PRAGMA integrity_check;"
sqlite3 "$SCRATCH/conductor.db" "SELECT COUNT(*) AS projects FROM projects;"
sqlite3 "$SCRATCH/conductor.db" "SELECT COUNT(*) AS workers FROM workers;"
```

`integrity_check` must return `ok`. Row counts should be non-negative; compare counts to a recent live query if you want a stronger check:

```bash
sqlite3 "$SRC" "SELECT COUNT(*) FROM projects;"
sqlite3 "$SCRATCH/conductor.db" "SELECT COUNT(*) FROM projects;"
```

Counts should match when backup was taken against the same primary without concurrent writes during the copy (for a live copy, WAL may make counts differ slightly—prefer quiesced backup for strict equality).

## 5. Optional: boot conductor against scratch only

Only on a **disposable** host port; do not point production workers at this instance.

```bash
export DATABASE_PATH="$SCRATCH/conductor.db"
export CONDUCTOR_PORT=39999
# Start conductor with DATABASE_PATH above (compose override or local node).
curl -sf "http://127.0.0.1:${CONDUCTOR_PORT}/health"
```

## 6. Teardown

```bash
rm -rf "$SCRATCH"
# Keep "$CONDUCTOR_BACKUP_DEST" if your backup retention policy requires it.
```

## Pass criteria

- [ ] `scripts/ops/conductor-backup.sh` exit 0 and `BACKUP.json` present.
- [ ] Scratch copy contains `conductor.db` (+ matching `-wal` / `-shm` when source had them).
- [ ] `PRAGMA integrity_check` → `ok`.
- [ ] Optional: `GET /health` 200 against scratch-backed conductor.
