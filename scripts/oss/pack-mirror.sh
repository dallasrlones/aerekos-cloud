#!/usr/bin/env bash
# Build a scrubbed tree suitable for a public OSS mirror.
# Keeps personal product apps out (aerekos-tv/music/drive, forged-lumen) and
# strips env/secret dumps per scripts/oss/mirror-denylist.txt.
#
# Usage:
#   scripts/oss/pack-mirror.sh [DEST_DIR]
# Default DEST: ../aerekos-cloud-oss-mirror

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEST="${1:-$ROOT/../aerekos-cloud-oss-mirror}"
DENYLIST="$ROOT/scripts/oss/mirror-denylist.txt"

cd "$ROOT"

echo "pack-mirror: scrubbing tracked files..."
bash "$ROOT/scripts/oss/check-mirror-scrub.sh"

echo "pack-mirror: exporting to $DEST"
rm -rf "$DEST"
mkdir -p "$DEST"

git ls-files -co --exclude-standard -z | rsync -a --files-from=- --from0 ./ "$DEST"/

python3 - "$DEST" "$DENYLIST" <<'PY'
import pathlib, re, shutil, sys

dest = pathlib.Path(sys.argv[1])
patterns = []
for line in pathlib.Path(sys.argv[2]).read_text().splitlines():
    line = line.split("#", 1)[0].strip()
    if line:
        patterns.append(line.lstrip("./"))


def glob_to_regex(pat: str) -> re.Pattern:
    """Translate limited gitignore-ish globs to regex (full-path match)."""
    i = 0
    out = ["^"]
    while i < len(pat):
        if pat.startswith("**/", i):
            out.append("(?:.*/)?")
            i += 3
        elif pat.startswith("/**", i):
            out.append("(?:/.*)?")
            i += 3
        elif pat[i] == "*":
            out.append("[^/]*")
            i += 1
        elif pat[i] == "?":
            out.append("[^/]")
            i += 1
        else:
            out.append(re.escape(pat[i]))
            i += 1
    out.append("$")
    return re.compile("".join(out))


compiled = [(p, glob_to_regex(p)) for p in patterns]
removed = []

for path in sorted(dest.rglob("*"), reverse=True):
    if path == dest:
        continue
    rel = path.relative_to(dest).as_posix()
    base = path.name
    hit = False
    for p, rx in compiled:
        if rx.match(rel) or rx.match(base) or (p == base) or (p == rel):
            hit = True
            break
        # directory prefix: pattern "foo" matches "foo/..."
        if "*" not in p and "?" not in p and "[" not in p:
            if rel == p or rel.startswith(p.rstrip("/") + "/"):
                hit = True
                break
    if hit:
        if path.is_dir():
            shutil.rmtree(path, ignore_errors=True)
        elif path.exists():
            path.unlink()
        removed.append(rel)

print(f"pack-mirror: removed {len(removed)} denylist path(s) from export")
for r in removed[:30]:
    print(f"  - {r}")
if len(removed) > 30:
    print(f"  ... +{len(removed) - 30} more")
PY

residual=$(find "$DEST" \( -name '.env' -o -name '.env.local' -o -name 'aerekos-tv' -o -name 'aerekos-music' -o -name 'aerekos-drive' -o -name 'forged-lumen' \) 2>/dev/null | head || true)
if [[ -n "$residual" ]]; then
  echo "pack-mirror: ERROR residual denylist paths in $DEST" >&2
  echo "$residual" >&2
  exit 1
fi

nfiles=$(find "$DEST" -type f | wc -l | tr -d ' ')
if [[ "$nfiles" -lt 100 ]]; then
  echo "pack-mirror: ERROR export too small ($nfiles files) — denylist over-matched" >&2
  exit 1
fi

echo "pack-mirror: OK → $DEST ($nfiles files)"
echo "pack-mirror: local preview tag only until review; do not push secrets or keepers"
