#!/usr/bin/env bash
# Offline / air-gap helper for external compose images.
#
# Most of the aerekos stack is `build:` from this repo. This script only
# caches the *pulled* images listed in docs/ops/offline-images.txt so a
# disconnected host can still `docker compose … up --build` without hitting
# Docker Hub / GHCR for those bases and sidecars.
#
# Usage:
#   scripts/ops/offline-image-cache.sh list
#   scripts/ops/offline-image-cache.sh pull
#   scripts/ops/offline-image-cache.sh save [dir]   # default: ./offline-image-cache
#   scripts/ops/offline-image-cache.sh load [dir]
#
# Parked (needs live registry or GPU fleet — not handled here):
#   registry:2 pull-through, INTERNAL_REGISTRY push/pull across workers,
#   Orin vLLM / STT / TTS images (commented in the image list).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LIST="${OFFLINE_IMAGE_LIST:-$ROOT/docs/ops/offline-images.txt}"
CACHE_DIR="${2:-$ROOT/offline-image-cache}"
CMD="${1:-list}"

if [[ ! -f "$LIST" ]]; then
  echo "error: image list not found: $LIST" >&2
  exit 1
fi

images() {
  # shellcheck disable=SC2013
  grep -vE '^\s*(#|$)' "$LIST" | sed 's/[[:space:]]*$//'
}

case "$CMD" in
  list)
    echo "# from $LIST"
    images
    ;;
  pull)
    while IFS= read -r img; do
      [[ -z "$img" ]] && continue
      echo "==> docker pull $img"
      docker pull "$img"
    done < <(images)
    echo "done. Next (optional): $0 save [dir]"
    ;;
  save)
    mkdir -p "$CACHE_DIR"
    while IFS= read -r img; do
      [[ -z "$img" ]] && continue
      safe="$(echo "$img" | tr '/:' '__')"
      out="$CACHE_DIR/${safe}.tar"
      echo "==> docker save $img → $out"
      docker save -o "$out" "$img"
    done < <(images)
    echo "bucket written under $CACHE_DIR"
    echo "Copy that directory to the offline host, then: $0 load $CACHE_DIR"
    ;;
  load)
    if [[ ! -d "$CACHE_DIR" ]]; then
      echo "error: cache dir not found: $CACHE_DIR" >&2
      exit 1
    fi
    shopt -s nullglob
    tars=("$CACHE_DIR"/*.tar)
    if [[ ${#tars[@]} -eq 0 ]]; then
      echo "error: no .tar files in $CACHE_DIR" >&2
      exit 1
    fi
    for tar in "${tars[@]}"; do
      echo "==> docker load -i $tar"
      docker load -i "$tar"
    done
    echo "loaded ${#tars[@]} archive(s). Build-local managers still need: make build / make up"
    ;;
  *)
    echo "usage: $0 {list|pull|save|load} [cache-dir]" >&2
    exit 2
    ;;
esac
