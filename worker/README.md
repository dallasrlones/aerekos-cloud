# aerekos-cloud Worker

The worker node for aerekos-cloud. Workers are slave devices that host and run services. They self-register with the conductor, report resources, maintain heartbeat connections, and execute Docker containers as instructed by the conductor.

**Manager services** (queues, schedules, compute, IAM, secrets, edge, networks, logs, registry, etc.): see [`MANAGER_SERVICES.md`](./MANAGER_SERVICES.md). **Implemented** packages are listed there; remaining folders are **templates** only (`/api/v1/info` returns `status: "stub"`) until you add product APIs. Core data-plane: `key_manager`, `storage_manager`, `db_manager`.

**Documentation:** every manager package `worker/<name>/` has a **`README.md`** (overview, default port, quick start, test commands). The canonical **per-service port** list also lives in [`../conductor/api/config/managerServicePorts.js`](../conductor/api/config/managerServicePorts.js) (keep in sync with `MANAGER_SERVICES.md` and `conductor/scripts/seedServices.js`).

## Status

🔄 **IN PROGRESS** - Basic worker implementation complete. Ready for testing.

## Features

- ✅ Self-registration with conductor using registration token
- ✅ Automatic resource detection (CPU, RAM, disk, network)
- ✅ Heartbeat mechanism to maintain connection with conductor
- ✅ Resource reporting to conductor
- ✅ Health check and status endpoints
- ✅ Automatic re-registration on connection loss
- ✅ Docker container management (worker agent + `ServiceManager`)
- ✅ Service deployment handling (orchestration path; see conductor + `GOLDEN_PATH.md`)

## Real-time Resource Usage (macOS)

For macOS Docker users, to get real-time RAM and disk usage updates (not just Docker VM stats), run the usage detection script periodically:

```bash
# Run once to test
./detect-host-usage.sh

# Set up a cron job to run every 5 seconds (for real-time updates)
# Add this to your crontab (crontab -e):
*/5 * * * * /Users/dallaslones/work/aerekos-cloud/worker/detect-host-usage.sh

# Or use launchd for more frequent updates (every 5 seconds)
# Create ~/Library/LaunchAgents/com.aerekos.worker-usage.plist:
```

The script writes Mac's actual RAM and disk usage to `/tmp/worker-usage.env`, which is mounted into the Docker container. The worker will read this file to get real-time Mac resource usage instead of Docker VM stats.

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Docker and Docker Compose (for containerized deployment)
- Registration token from conductor

### Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Copy environment file:**
```bash
cp .env_example .env
```

3. **Update `.env` with your configuration:**
```bash
CONDUCTOR_URL=https://cloudapi.aerekos.com
CONDUCTOR_TOKEN=<token-from-conductor>
PORT=3001
```

**Note:** All device info (hostname, IP, CPU, RAM, disk) is automatically detected by the entrypoint script. No manual configuration needed! 

**Platform-Specific Setup:**
- **macOS Docker Desktop**: 
  - Run `./detect-host-resources.sh` before starting for best results
  - Use `docker-compose -f docker-compose.yml -f docker-compose.mac.yml up` to exclude cgroup mount (not available on Mac)
  - Code gracefully handles missing cgroups - falls back to systeminformation
- **Ubuntu/Linux**: 
  - Use standard `docker-compose up` - cgroup mount works automatically
  - Full cgroup support for accurate resource monitoring
  - No additional setup needed

4. **For macOS Docker users - Real-time Resource Usage:**

   To get **real-time** RAM and disk usage updates (not just Docker VM stats), run the usage detection script periodically:
   
   ```bash
   # Run once to test
   ./detect-host-usage.sh
   
   # Set up to run every 5 seconds (for real-time updates)
   # Option 1: Use a simple loop (for testing)
   while true; do ./detect-host-usage.sh; sleep 5; done &
   
   # Option 2: Use launchd (recommended for production)
   # Create ~/Library/LaunchAgents/com.aerekos.worker-usage.plist
   ```
   
   The script writes Mac's actual RAM and disk usage to `/tmp/worker-usage.env`, which is automatically mounted into the Docker container. The worker will read this file to get real-time Mac resource usage instead of Docker VM stats.

5. **For macOS Docker users (optional but recommended):**
   ```bash
   # Detect actual Mac resources and write to file
   ./detect-host-resources.sh
   ```
   This will detect your Mac's actual CPU cores, RAM, and disk space and write them to `/tmp/worker-resources.env`, which will be automatically loaded by the Docker container.

5. **Start the worker:**
```bash
npm start
```

Or for development (with auto-restart on code changes):
```bash
npm run dev
```

### Docker

Build and run with Docker Compose:

```bash
# First, detect Mac resources (optional but recommended on macOS)
./detect-host-resources.sh

# Then start - works on both Mac and Linux automatically
docker compose up --build
```

**Note**: The cgroup mount is not included by default (Docker Compose fails if source doesn't exist on macOS).
- **macOS**: Code gracefully handles missing cgroups and falls back to systeminformation
- **Linux**: Code works without cgroups, but you can manually add the mount to docker-compose.yml for more accurate resource monitoring:
  ```yaml
  - /sys/fs/cgroup:/host/sys/fs/cgroup:ro
  ```

**Note**: Make sure the `aerekos-network` network exists:
```bash
docker network create aerekos-network
```

## Configuration

### Environment Variables

**Required:**
- `CONDUCTOR_URL` - Public conductor API URL (`.env_example`: `https://cloudapi.aerekos.com`; no localhost fallback)
- `CONDUCTOR_TOKEN` - Registration token from conductor (required)

**Optional:**
- `PORT` - Worker API port (default: 3001)
- `HEARTBEAT_INTERVAL` - Heartbeat interval in seconds (default: 30)
- `RESOURCE_CHECK_INTERVAL` - Resource check interval in seconds (default: 60)

**Note:** `WORKER_HOSTNAME` and `WORKER_IP` are automatically detected by conductor from the registration request. They are stored in memory only and will be re-detected on worker restart.

## API Endpoints

### Health Check
- `GET /health` - Health check endpoint

### Status
- `GET /status` - Get worker status and resource information

## Architecture

The worker:
1. **Registers** with conductor using a registration token
2. **Reports** available resources (CPU, RAM, disk, network)
3. **Maintains** heartbeat connection with conductor
4. **Receives** deployment instructions from the conductor
5. **Executes** Docker containers for services via the deployed stack
6. **Reports** service status back to the conductor

## Testing the worker agent

From this directory:

```bash
npm test
```

Uses Jest under `tests/` (unit + integration). Integration tests start a **mock conductor** on **`127.0.0.1:31900`** by default so a real conductor on **3000** or **key_manager** on **3002** does not answer those requests by mistake. Override with `MOCK_CONDUCTOR_PORT` if needed.

**Manager services** (`queue_manager`, `webhook_manager`, …) are **separate** packages under `worker/<name>/` — each has its own `npm test`. See [`MANAGER_SERVICES.md`](./MANAGER_SERVICES.md).

## Development

### Project Structure

```
worker/
├── api/
│   └── services/
│       └── ConductorService.js    # Conductor API client
├── utils/
│   └── resourceDetector.js        # Resource detection utilities
├── index.js                        # Main worker entry point
├── package.json
├── .env_example
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## Next Steps

See [plan.md](./plan.md) for detailed implementation checklist and next steps.

