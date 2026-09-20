#!/bin/sh
set -e

echo "[key_manager] Starting key manager service..."

# Master Key Loading
# Priority 1: MASTER_KEY from environment (set by worker after reading USB)
# Priority 2: Dev fallback (development mode only)
if [ -z "$MASTER_KEY" ]; then
  echo "[key_manager] WARNING: MASTER_KEY not set - using default for development only"
  echo "[key_manager] NOTE: In production, worker should read USB encryption_key and pass MASTER_KEY via environment"
  export MASTER_KEY="dev-master-key-change-in-production"
else
  echo "[key_manager] ✓ MASTER_KEY loaded from environment (worker read from USB)"
fi

# Auto-detect port if needed
if [ -z "$PORT" ]; then
  PORT=$(node -e "const net = require('net'); const server = net.createServer(); server.listen(0, () => { console.log(server.address().port); server.close(); });")
  export PORT
fi

# Start service
exec node index.js
