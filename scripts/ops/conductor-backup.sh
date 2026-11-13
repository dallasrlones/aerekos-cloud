#!/usr/bin/env bash
# One-shot conductor SQLite backup (cold or live copy).
#
# Usage:
#   CONDUCTOR_BACKUP_DEST=/var/backups/conductor/2026-11-12 ./scripts/ops/conductor-backup.sh
#
# Env:
#   DATABASE_PATH     — source db (default: conductor/data/conductor.db)
#   CONDUCTOR_BACKUP_DEST — required output directory
#   CONDUCTOR_URL       — if set and backup_manager HTTP export is added later, prefer API
#
# Note: No dedicated conductor "export SoR" HTTP route exists today. This script copies
# the SQLite file triplet. For queued vault backups use backup_manager via the UI/API.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SRC="${DATABASE_PATH:-$ROOT/conductor/data/conductor.db}"
DEST="${CONDUCTOR_BACKUP_DEST:-}"

if [[ -z "$DEST" ]]; then
  echo "CONDUCTOR_BACKUP_DEST is required" >&2
  exit 1
fi

mkdir -p "$DEST"
BASE="$(basename "$SRC")"

copy_if_exists() {
  local from="$1" to="$2"
  if [[ -f "$from" ]]; then
    cp -a "$from" "$to"
    return 0
  fi
  return 1
}

if ! copy_if_exists "$SRC" "$DEST/$BASE"; then
  echo "missing source: $SRC" >&2
  exit 1
fi

copy_if_exists "${SRC}-wal" "$DEST/${BASE}-wal" || true
copy_if_exists "${SRC}-shm" "$DEST/${BASE}-shm" || true

STAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
cat > "$DEST/BACKUP.json" <<EOF
{"source":"$SRC","copied_at":"$STAMP","kind":"sqlite-triplet"}
EOF

echo "[conductor-backup] $STAMP → $DEST"
