#!/usr/bin/env bash
# Portable one-command worker launcher.
#
# Detects this machine's real hostname/IP/CPU/RAM/disk/network, writes them to
# .worker-host.env, then builds and starts the worker container. Works on macOS
# and Linux (x86_64 / arm64).
#
# Prereqs: Docker + Docker Compose, and a worker/.env with at least:
#   CONDUCTOR_URL=http://<conductor-host>:<port>
#   CONDUCTOR_TOKEN=<registration token from the conductor>
#
# Usage:  cd worker && ./up.sh
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "✗ worker/.env not found. Copy .env_example to .env and set CONDUCTOR_URL + CONDUCTOR_TOKEN." >&2
  exit 1
fi

echo "→ Detecting host resources..."
bash detect-host-resources.sh .worker-host.env

echo "→ Building and starting the worker..."
docker compose up -d --build

echo "→ Done. Tail logs with:  docker compose logs -f"
