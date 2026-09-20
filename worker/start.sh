#!/bin/bash
set -e

# Auto-detect OS and run docker compose with appropriate configuration
# Supports both docker-compose (v1) and docker compose (v2)

# Detect OS and cgroup availability
if [[ "$OSTYPE" == "darwin"* ]] || [ ! -d "/sys/fs/cgroup" ]; then
    # macOS or cgroup not available
    echo "🍎 Detected macOS or cgroup not available - using Mac-specific configuration (excluding cgroup mount)"
    
    # Check if docker-compose (v1) or docker compose (v2) is available
    if command -v docker-compose &> /dev/null; then
        docker-compose -f docker-compose.yml -f docker-compose.mac.yml "$@"
    elif docker compose version &> /dev/null; then
        docker compose -f docker-compose.yml -f docker-compose.mac.yml "$@"
    else
        echo "❌ Error: Neither 'docker-compose' nor 'docker compose' found"
        exit 1
    fi
else
    # Linux/Ubuntu with cgroup available
    echo "🐧 Detected Linux - using standard configuration (with cgroup mount)"
    
    # Check if docker-compose (v1) or docker compose (v2) is available
    if command -v docker-compose &> /dev/null; then
        docker-compose "$@"
    elif docker compose version &> /dev/null; then
        docker compose "$@"
    else
        echo "❌ Error: Neither 'docker-compose' nor 'docker compose' found"
        exit 1
    fi
fi

