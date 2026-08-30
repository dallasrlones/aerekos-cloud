#!/bin/sh
set -e

echo "🔍 Detecting host system resources..."

# Check if cgroup mount is available (Linux) or not (macOS)
if [ ! -d "/host/sys/fs/cgroup" ]; then
    echo "  ℹ️  Cgroup mount not available (macOS or not mounted) - using fallback resource detection"
fi

# Initialize defaults
CPU_CORES=""
RAM_GB=""
DISK_GB=""
HOSTNAME=""
IP_ADDRESS=""
NET_MBPS=""

# NOTE on hostname / IP / network: these come from the host's network + UTS
# namespaces, which a bind-mounted /host/proc and /host/sys do NOT expose
# (those proc/sys files are namespace-scoped, not mount-scoped). The reliable,
# cross-platform way to get them is to run detect-host-resources.sh ON THE HOST
# (./up.sh or `make worker` does this) which writes WORKER_HOSTNAME / WORKER_IP /
# WORKER_NETWORK_MBPS into the environment. We honor those here and only fall back
# to container values otherwise. CPU/RAM/disk DO work from /host/proc below.

# Method 0: Check for pre-detected resources file (from detect-host-resources.sh)
if [ -f /tmp/worker-resources.env ]; then
    echo "  ✓ Found pre-detected resources file"
    . /tmp/worker-resources.env
    CPU_CORES=${WORKER_CPU_CORES:-$CPU_CORES}
    RAM_GB=${WORKER_RAM_GB:-$RAM_GB}
    DISK_GB=${WORKER_DISK_GB:-$DISK_GB}
    HOSTNAME=${WORKER_HOSTNAME:-$HOSTNAME}
    IP_ADDRESS=${WORKER_IP:-$IP_ADDRESS}
fi

# Hostname: WORKER_HOSTNAME (from .worker-host.env / .env) wins via the export
# below. Fall back to the container hostname only when it wasn't provided.
if [ -z "$HOSTNAME" ] && [ -z "$WORKER_HOSTNAME" ]; then
    HOSTNAME=$(hostname 2>/dev/null || echo "")
    [ -n "$HOSTNAME" ] && echo "  ⚠️  Using container hostname: $HOSTNAME (run ./up.sh on the host for the real device name)"
fi

# IP: WORKER_IP (from .worker-host.env / .env) wins via the export below. Fall
# back to a best-effort container interface IP when it wasn't provided.
if [ -z "$IP_ADDRESS" ] && [ -z "$WORKER_IP" ]; then
    IP_ADDRESS=$(ip -4 addr show 2>/dev/null | grep -oE 'inet [0-9.]+' | awk '{print $2}' \
        | grep -v '^127\.' | head -1 || echo "")
    [ -n "$IP_ADDRESS" ] && echo "  ⚠️  Using container IP: $IP_ADDRESS (run ./up.sh on the host for the real LAN IP)"
fi

# Method 2: Try to read from mounted host /proc (Linux host or macOS Docker VM)
if [ -f /host/proc/cpuinfo ]; then
    CPU_CORES=$(grep -c "^processor" /host/proc/cpuinfo 2>/dev/null || echo "")
    if [ -n "$CPU_CORES" ]; then
        echo "  ✓ CPU cores from /host/proc: $CPU_CORES"
    fi
fi

if [ -f /host/proc/meminfo ]; then
    RAM_KB=$(grep "^MemTotal:" /host/proc/meminfo 2>/dev/null | awk '{print $2}' || echo "")
    if [ -n "$RAM_KB" ] && [ "$RAM_KB" != "0" ]; then
        RAM_GB=$((RAM_KB / 1024 / 1024))
        echo "  ✓ RAM from /host/proc: ${RAM_GB} GB"
    fi
fi

# Method 2: If we're on macOS Docker, try to detect actual Mac resources
# We'll use a helper script that runs on the host if available
# For now, check if we can access host.docker.internal and try to get Mac info
if [ -f /.dockerenv ] && [ -z "$RAM_GB" ] || [ "$RAM_GB" -lt 8 ]; then
    # We're in Docker - check if host is macOS by trying to detect Mac-specific paths
    # If /host/proc shows low RAM (< 8GB), likely macOS Docker VM
    if [ -n "$RAM_GB" ] && [ "$RAM_GB" -lt 8 ]; then
        echo "  ⚠️  Low RAM detected (${RAM_GB} GB), likely macOS Docker VM"
        echo "  💡 Tip: Set WORKER_RAM_GB in .env to override"
    fi
fi

# Method 3: Fallback to container resources
if [ -z "$CPU_CORES" ]; then
    CPU_CORES=$(nproc 2>/dev/null || grep -c processor /proc/cpuinfo 2>/dev/null || echo "1")
    echo "  ⚠️  Using container CPU cores: $CPU_CORES"
fi

if [ -z "$RAM_GB" ]; then
    if [ -f /proc/meminfo ]; then
        RAM_KB=$(grep "^MemTotal:" /proc/meminfo | awk '{print $2}' || echo "0")
        RAM_GB=$((RAM_KB / 1024 / 1024))
    else
        RAM_GB=$(free -g 2>/dev/null | awk '/^Mem:/ {print $2}' || echo "1")
    fi
    echo "  ⚠️  Using container RAM: ${RAM_GB} GB"
fi

if [ -z "$DISK_GB" ]; then
    DISK_GB=$(df -BG / 2>/dev/null | awk 'NR==2 {print $2}' | sed 's/G//' || echo "1")
    echo "  ⚠️  Using container disk: ${DISK_GB} GB"
fi

# Network link speed (Mbps) comes from WORKER_NETWORK_MBPS (detect-host-resources.sh
# on the host); there is no reliable in-container source, so we just pass it through.

# Export environment variables (allow overrides from .env / .worker-host.env)
# These will be used by resourceDetector.js and worker registration
export WORKER_CPU_CORES=${WORKER_CPU_CORES:-$CPU_CORES}
export WORKER_RAM_GB=${WORKER_RAM_GB:-$RAM_GB}
export WORKER_DISK_GB=${WORKER_DISK_GB:-$DISK_GB}
export WORKER_HOSTNAME=${WORKER_HOSTNAME:-$HOSTNAME}
export WORKER_IP=${WORKER_IP:-$IP_ADDRESS}
[ -n "${WORKER_NETWORK_MBPS:-$NET_MBPS}" ] && export WORKER_NETWORK_MBPS=${WORKER_NETWORK_MBPS:-$NET_MBPS}

echo ""
echo "✅ Resource detection complete:"
echo "   Hostname: ${WORKER_HOSTNAME:-<not detected>}"
echo "   IP Address: ${WORKER_IP:-<not detected>}"
echo "   CPU Cores: ${WORKER_CPU_CORES:-<not detected>}"
echo "   RAM: ${WORKER_RAM_GB:-<not detected>} GB"
echo "   Disk: ${WORKER_DISK_GB:-<not detected>} GB"
echo "   Network: ${WORKER_NETWORK_MBPS:-<unknown>} Mbps"
echo ""

# Execute the main command
exec "$@"

