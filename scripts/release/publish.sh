#!/usr/bin/env bash
# scripts/release/publish.sh — publish the current repo as a new release to the
# conductor's built-in release server ("our own GitHub").
#
# Run this ON THE CONDUCTOR HOST (prod-mini), from the repo dir:
#     bash scripts/release/publish.sh                       # auto timestamp version
#     bash scripts/release/publish.sh --version 2026.06.06  --notes "fix X"
#
# Devices' updater sidecars poll the conductor and pull this release.
#
# Env overrides:
#   CONDUCTOR_URL     (default http://localhost:3300)
#   AEREKOS_ADMIN_USER / AEREKOS_ADMIN_PASS  (default admin / admin)
set -euo pipefail

REPO_DIR="${AEREKOS_DEPLOY_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
CONDUCTOR_URL="${CONDUCTOR_URL:-http://localhost:3300}"
ADMIN_USER="${AEREKOS_ADMIN_USER:-admin}"
ADMIN_PASS="${AEREKOS_ADMIN_PASS:-admin}"
VERSION=""
NOTES=""

while [ $# -gt 0 ]; do
  case "$1" in
    --version) VERSION="$2"; shift 2 ;;
    --notes)   NOTES="$2";   shift 2 ;;
    --url)     CONDUCTOR_URL="$2"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

[ -n "$VERSION" ] || VERSION="$(date -u +%Y%m%d-%H%M%S)"

echo "▶ Packaging $REPO_DIR as release $VERSION"
TARBALL="$(mktemp /tmp/aerekos-release.XXXXXX.tar.gz)"
trap 'rm -f "$TARBALL"' EXIT

tar czf "$TARBALL" -C "$REPO_DIR" \
  --exclude='./.git' \
  --exclude='./node_modules' --exclude='*/node_modules' \
  --exclude='./.expo' --exclude='*/.expo' \
  --exclude='./coverage' --exclude='*/coverage' \
  --exclude='*/data' --exclude='./data' \
  --exclude='.env' --exclude='*.env' \
  --exclude='./VERSION' \
  --exclude='*.tar.gz' \
  .

SIZE=$(wc -c < "$TARBALL" | tr -d ' ')
echo "▶ Bundle: $((SIZE / 1024)) KB"

echo "▶ Authenticating to $CONDUCTOR_URL"
TOKEN=$(curl -fsS -X POST "$CONDUCTOR_URL/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}" \
  | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
[ -n "$TOKEN" ] || { echo "✗ Login failed (set AEREKOS_ADMIN_USER/PASS)"; exit 1; }

echo "▶ Uploading release $VERSION"
NOTES_ENC=$(printf %s "$NOTES" | jq -sRr @uri 2>/dev/null || printf %s "$NOTES")
RESP=$(curl -fsS -X POST \
  "$CONDUCTOR_URL/api/releases?version=$VERSION&notes=$NOTES_ENC" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/gzip' \
  --data-binary "@$TARBALL")

echo "✓ Published:"
echo "$RESP" | (jq . 2>/dev/null || cat)
echo ""
echo "Devices will pull this on their next updater poll, or click 'Update now' in the dashboard."
