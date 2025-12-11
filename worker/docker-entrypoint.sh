#!/bin/sh
set -e

echo "🔍 Detecting host system resources..."

# Initialize defaults
CPU_CORES=""
RAM_GB=""
DISK_GB=""
HOSTNAME=""
IP_ADDRESS=""

# Method 0: Check for pre-detected resources file (from detect-host-resources.sh)
if [ -f /tmp/worker-resources.env ]; then
    echo "  ✓ Found pre-detected resources file"
    source /tmp/worker-resources.env
    CPU_CORES=${WORKER_CPU_CORES:-$CPU_CORES}
    RAM_GB=${WORKER_RAM_GB:-$RAM_GB}
    DISK_GB=${WORKER_DISK_GB:-$DISK_GB}
    HOSTNAME=${WORKER_HOSTNAME:-$HOSTNAME}
    IP_ADDRESS=${WORKER_IP:-$IP_ADDRESS}
fi

# Method 1: Detect hostname and IP
# Try to get hostname from host
if [ -z "$HOSTNAME" ]; then
    # Try hostname command (works on both Linux and macOS)
    HOSTNAME=$(hostname 2>/dev/null || echo "")
    if [ -n "$HOSTNAME" ]; then
        echo "  ✓ Hostname: $HOSTNAME"
    fi
fi

# Try to detect IP address
if [ -z "$IP_ADDRESS" ]; then
    # Method 1: Try to get from host network interfaces via /host/proc/net/route
    if [ -f /host/proc/net/route ]; then
        # Get default gateway interface
        DEFAULT_IF=$(awk '/^00000000/ {if ($2 != "00000000") print $8; exit}' /host/proc/net/route 2>/dev/null || echo "")
        if [ -n "$DEFAULT_IF" ]; then
            # Get IP from /host/proc/net/fib_trie or /host/sys/class/net
            if [ -f /host/proc/net/fib_trie ]; then
                IP_ADDRESS=$(grep -A 1 "$DEFAULT_IF" /host/proc/net/fib_trie 2>/dev/null | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' | head -1 || echo "")
            fi
            # Fallback: try /host/sys/class/net
            if [ -z "$IP_ADDRESS" ] && [ -d "/host/sys/class/net/$DEFAULT_IF" ]; then
                IP_ADDRESS=$(cat /host/sys/class/net/$DEFAULT_IF/address 2>/dev/null | head -1 || echo "")
            fi
        fi
    fi
    
    # Method 2: Try to resolve host.docker.internal (for macOS Docker)
    if [ -z "$IP_ADDRESS" ] && [ -f /.dockerenv ]; then
        HOST_IP=$(getent hosts host.docker.internal 2>/dev/null | awk '{print $1}' | head -1 || echo "")
        if [ -n "$HOST_IP" ] && [ "$HOST_IP" != "127.0.0.1" ]; then
            # This is the gateway IP, try to get actual host IP
            GATEWAY=$(ip route | grep default | awk '{print $3}' 2>/dev/null || echo "")
            if [ -n "$GATEWAY" ]; then
                IP_ADDRESS=$GATEWAY
            fi
        fi
    fi
    
    # Method 3: Try to get from container's network interface (fallback)
    if [ -z "$IP_ADDRESS" ]; then
        # Get first non-loopback, non-Docker interface IP
        IP_ADDRESS=$(ip -4 addr show 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1' | grep -v '172.17' | grep -v '172.19' | head -1 || echo "")
    fi
    
    if [ -n "$IP_ADDRESS" ]; then
        echo "  ✓ IP Address: $IP_ADDRESS"
    fi
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

# Export environment variables (allow overrides from .env)
# These will be used by resourceDetector.js and worker registration
export WORKER_CPU_CORES=${WORKER_CPU_CORES:-$CPU_CORES}
export WORKER_RAM_GB=${WORKER_RAM_GB:-$RAM_GB}
export WORKER_DISK_GB=${WORKER_DISK_GB:-$DISK_GB}
export WORKER_HOSTNAME=${WORKER_HOSTNAME:-$HOSTNAME}
export WORKER_IP=${WORKER_IP:-$IP_ADDRESS}

echo ""
echo "✅ Resource detection complete:"
echo "   Hostname: ${WORKER_HOSTNAME:-<not detected>}"
echo "   IP Address: ${WORKER_IP:-<not detected>}"
echo "   CPU Cores: ${WORKER_CPU_CORES:-<not detected>}"
echo "   RAM: ${WORKER_RAM_GB:-<not detected>} GB"
echo "   Disk: ${WORKER_DISK_GB:-<not detected>} GB"
echo ""

# Execute the main command
exec "$@"

