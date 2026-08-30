#!/bin/bash
# Wrapper script that auto-detects OS and runs docker compose with correct config
# This allows you to just run: docker compose up --build (via alias or symlink)

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Detect OS and cgroup availability
if [[ "$OSTYPE" == "darwin"* ]] || [ ! -d "/sys/fs/cgroup" ]; then
    # macOS or cgroup not available - use Mac override
    if command -v docker-compose &> /dev/null; then
        docker-compose -f docker-compose.yml -f docker-compose.mac.yml "$@"
    elif docker compose version &> /dev/null; then
        docker compose -f docker-compose.yml -f docker-compose.mac.yml "$@"
    else
        echo "❌ Error: Neither 'docker-compose' nor 'docker compose' found"
        exit 1
    fi
else
    # Linux/Ubuntu with cgroup available - use standard config
    if command -v docker-compose &> /dev/null; then
        docker-compose "$@"
    elif docker compose version &> /dev/null; then
        docker compose "$@"
    else
        echo "❌ Error: Neither 'docker-compose' nor 'docker compose' found"
        exit 1
    fi
fi

