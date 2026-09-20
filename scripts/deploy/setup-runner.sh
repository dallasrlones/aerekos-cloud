#!/usr/bin/env bash
# scripts/deploy/setup-runner.sh — install a self-hosted GitHub Actions runner
# on THIS device so it can pick up aerekos-cloud deploy jobs.
#
# Run this once per device. It downloads the official runner, registers it with
# the repo using a short-lived registration token, and installs it as a service
# so it survives reboots.
#
# Get a registration token (valid ~1h) one of these ways:
#   • GitHub → repo → Settings → Actions → Runners → "New self-hosted runner"
#   • gh api -X POST repos/dallasrlones/aerekos-cloud/actions/runners/registration-token -q .token
#
# Usage:
#   GH_RUNNER_TOKEN=XXXXX bash scripts/deploy/setup-runner.sh --labels prod
#   GH_RUNNER_TOKEN=XXXXX bash scripts/deploy/setup-runner.sh --labels oculus
#   GH_RUNNER_TOKEN=XXXXX bash scripts/deploy/setup-runner.sh --labels dev
#
# The runner is always tagged `self-hosted,aerekos,<label>`; the deploy workflow
# targets jobs at those labels.
set -euo pipefail

REPO_URL="${AEREKOS_REPO_URL:-https://github.com/dallasrlones/aerekos-cloud}"
RUNNER_DIR="${AEREKOS_RUNNER_DIR:-$HOME/actions-runner-aerekos}"
NAME="$(hostname -s 2>/dev/null || hostname)"
TOKEN="${GH_RUNNER_TOKEN:-}"
LABELS=""

while [ $# -gt 0 ]; do
  case "$1" in
    --labels) LABELS="$2"; shift 2;;
    --name)   NAME="$2";   shift 2;;
    --token)  TOKEN="$2";  shift 2;;
    --repo)   REPO_URL="$2"; shift 2;;
    -h|--help) sed -n '2,30p' "$0"; exit 0;;
    *) echo "Unknown arg: $1" >&2; exit 1;;
  esac
done

[ -n "$TOKEN" ]  || { echo "✗ Need a registration token (GH_RUNNER_TOKEN env or --token)." >&2; exit 1; }
[ -n "$LABELS" ] || { echo "✗ Need --labels (one of: prod | oculus | dev)." >&2; exit 1; }

FULL_LABELS="aerekos,${LABELS}"

# --- resolve platform -------------------------------------------------------
OS="$(uname -s)"; ARCH="$(uname -m)"
case "$OS" in
  Linux)  ROS=linux;;
  Darwin) ROS=osx;;
  *) echo "✗ Unsupported OS: $OS" >&2; exit 1;;
esac
case "$ARCH" in
  x86_64|amd64)  RARCH=x64;;
  aarch64|arm64) RARCH=arm64;;
  *) echo "✗ Unsupported arch: $ARCH" >&2; exit 1;;
esac

# --- download the runner ----------------------------------------------------
mkdir -p "$RUNNER_DIR"; cd "$RUNNER_DIR"
VER="$(curl -fsSL https://api.github.com/repos/actions/runner/releases/latest \
        | grep -m1 '"tag_name"' | sed -E 's/.*"v?([^"]+)".*/\1/')"
[ -n "$VER" ] || { echo "✗ Could not resolve the latest runner version." >&2; exit 1; }

TARBALL="actions-runner-${ROS}-${RARCH}-${VER}.tar.gz"
if [ ! -f "$TARBALL" ]; then
  echo "→ Downloading runner ${VER} (${ROS}-${RARCH})"
  curl -fsSL -o "$TARBALL" \
    "https://github.com/actions/runner/releases/download/v${VER}/${TARBALL}"
fi
tar xzf "$TARBALL"

# --- configure --------------------------------------------------------------
echo "→ Configuring runner '${NAME}' (labels: ${FULL_LABELS})"
./config.sh --unattended --replace \
  --url "$REPO_URL" \
  --token "$TOKEN" \
  --name "$NAME" \
  --labels "$FULL_LABELS" \
  --work _work

# --- install as a service ---------------------------------------------------
echo "→ Installing the runner service"
if [ "$ROS" = "linux" ]; then
  sudo ./svc.sh install "$USER"
  sudo ./svc.sh start
  sudo ./svc.sh status || true
else
  ./svc.sh install
  ./svc.sh start
  ./svc.sh status || true
fi

cat <<EOF

✓ Runner '${NAME}' is live with labels: self-hosted, ${FULL_LABELS//,/, }
  Deploy jobs targeting '${LABELS}' will now run on this device.

  Manage it from $RUNNER_DIR:
    sudo ./svc.sh status|stop|start     (Linux)
    ./svc.sh status|stop|start          (macOS)
EOF
