#!/usr/bin/env bash
# Fail if any mirror-denylist path appears in git-tracked files (default), or in
# the exportable tree when CHECK_MIRROR_SCRUB_ALL=1.
# Local gitignored secrets (conductor/.env) are fine privately — pack-mirror.sh
# must exclude them. Run from the aerekos-cloud repository root.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DENYLIST="${ROOT}/scripts/oss/mirror-denylist.txt"
cd "$ROOT"

if [[ ! -f "$DENYLIST" ]]; then
  echo "check-mirror-scrub: missing denylist at $DENYLIST" >&2
  exit 2
fi

MODE=tracked
if [[ "${CHECK_MIRROR_SCRUB_ALL:-}" == "1" ]]; then
  MODE=exportable
fi

python3 - "$DENYLIST" "$MODE" <<'PY'
import pathlib, re, subprocess, sys

denylist_path, mode = sys.argv[1], sys.argv[2]

if mode == "exportable":
    raw = subprocess.check_output(
        ["git", "ls-files", "-co", "--exclude-standard"], text=True
    )
else:
    raw = subprocess.check_output(["git", "ls-files"], text=True)
candidates = [p for p in raw.splitlines() if p]

patterns = []
for line in pathlib.Path(denylist_path).read_text().splitlines():
    line = line.split("#", 1)[0].strip()
    if line:
        patterns.append(line.lstrip("./"))


def glob_to_regex(pat: str) -> re.Pattern:
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
failures = 0
for p, rx in compiled:
    hits = []
    for cand in candidates:
        base = pathlib.PurePosixPath(cand).name
        if rx.match(cand) or rx.match(base) or cand == p or base == p:
            hits.append(cand)
            continue
        if "*" not in p and "?" not in p and "[" not in p:
            if cand == p or cand.startswith(p.rstrip("/") + "/"):
                hits.append(cand)
    if hits:
        print(f"DENYLIST MATCH: {p}", file=sys.stderr)
        for h in hits[:40]:
            print(f"  {h}", file=sys.stderr)
            failures += 1
        if len(hits) > 40:
            print(f"  ... +{len(hits) - 40} more", file=sys.stderr)
            failures += len(hits) - 40

if failures:
    print(
        f"\ncheck-mirror-scrub: {failures} denylist violation(s) in {mode} files.",
        file=sys.stderr,
    )
    print(
        "Remove from git, or exclude via scripts/oss/pack-mirror.sh before publishing.",
        file=sys.stderr,
    )
    sys.exit(1)

print(f"check-mirror-scrub: OK (no denylisted paths in {mode} files)")
PY
