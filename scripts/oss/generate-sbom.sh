#!/usr/bin/env bash
# W16 — emit artifacts/sbom.json from the workspace dependency tree.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

OUT_DIR="${SBOM_OUT_DIR:-$ROOT/artifacts}"
OUT_FILE="${SBOM_OUT_FILE:-$OUT_DIR/sbom.json}"
mkdir -p "$OUT_DIR"

log() { echo "[generate-sbom] $*"; }

SPEC_VERSION=''
if command -v cyclonedx-npm >/dev/null 2>&1; then
  log "cyclonedx-npm → $OUT_FILE"
  cyclonedx-npm --output-file "$OUT_FILE" --omit dev 2>/dev/null || cyclonedx-npm --output-file "$OUT_FILE"
  SPEC_VERSION='CycloneDX (cyclonedx-npm CLI)'
elif npx --no-install @cyclonedx/cyclonedx-npm --version >/dev/null 2>&1; then
  log "@cyclonedx/cyclonedx-npm → $OUT_FILE"
  npx --no-install @cyclonedx/cyclonedx-npm --output-file "$OUT_FILE" --omit dev 2>/dev/null \
    || npx --no-install @cyclonedx/cyclonedx-npm --output-file "$OUT_FILE"
  SPEC_VERSION='CycloneDX (@cyclonedx/cyclonedx-npm)'
else
  log "fallback: npm ls --all --json → $OUT_FILE"
  npm ls --all --json >"$OUT_FILE" || {
    # npm ls exits non-zero when peer deps are unmet; keep artifact if file was written
    [[ -s "$OUT_FILE" ]] || exit 1
  }
  SPEC_VERSION='npm ls JSON (not CycloneDX; install cyclonedx-npm for SPDX/CycloneDX)'
fi

log "wrote $OUT_FILE ($SPEC_VERSION)"
if command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "$OUT_FILE" | tee "$OUT_FILE.sha256"
elif command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$OUT_FILE" | tee "$OUT_FILE.sha256"
fi
