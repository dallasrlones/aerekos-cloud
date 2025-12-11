#!/bin/bash
# Helper script to detect macOS host resources and write to a file
# This can be run on the macOS host before starting Docker

set -e

OUTPUT_FILE="${1:-/tmp/worker-resources.env}"

echo "🔍 Detecting macOS host resources..."

if [ "$(uname)" != "Darwin" ]; then
    echo "⚠️  This script is for macOS only"
    exit 1
fi

# Detect hostname
HOSTNAME=$(hostname)
echo "  Hostname: $HOSTNAME"

# Detect IP address (get primary network interface IP)
# Get the default route interface
DEFAULT_INTERFACE=$(route get default 2>/dev/null | grep interface | awk '{print $2}' || echo "")
if [ -n "$DEFAULT_INTERFACE" ]; then
    IP_ADDRESS=$(ipconfig getifaddr "$DEFAULT_INTERFACE" 2>/dev/null || echo "")
    if [ -z "$IP_ADDRESS" ]; then
        # Fallback: try ifconfig
        IP_ADDRESS=$(ifconfig "$DEFAULT_INTERFACE" 2>/dev/null | grep "inet " | awk '{print $2}' | head -1 || echo "")
    fi
fi

# If still no IP, try to get from any active interface
if [ -z "$IP_ADDRESS" ]; then
    IP_ADDRESS=$(ifconfig | grep "inet " | grep -v "127.0.0.1" | awk '{print $2}' | head -1 || echo "")
fi

if [ -n "$IP_ADDRESS" ]; then
    echo "  IP Address: $IP_ADDRESS"
else
    echo "  ⚠️  Could not detect IP address"
fi

# Detect CPU cores
CPU_CORES=$(sysctl -n hw.ncpu)
echo "  CPU cores: $CPU_CORES"

# Detect RAM
RAM_BYTES=$(sysctl -n hw.memsize)
RAM_GB=$((RAM_BYTES / 1024 / 1024 / 1024))
echo "  RAM: ${RAM_GB} GB"

# Detect disk space
DISK_GB=$(df -g / | awk 'NR==2 {print $2}')
echo "  Disk: ${DISK_GB} GB"

# Write to file
cat > "$OUTPUT_FILE" <<EOF
# Auto-detected macOS host resources
WORKER_HOSTNAME=$HOSTNAME
WORKER_IP=$IP_ADDRESS
WORKER_CPU_CORES=$CPU_CORES
WORKER_RAM_GB=$RAM_GB
WORKER_DISK_GB=$DISK_GB
EOF

echo ""
echo "✅ Resources written to: $OUTPUT_FILE"
echo ""
cat "$OUTPUT_FILE"

