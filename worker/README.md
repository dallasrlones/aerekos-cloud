# aerekos-cloud Worker

The worker node for aerekos-cloud. Workers are slave devices that host and run services. They self-register with the conductor, report resources, maintain heartbeat connections, and execute Docker containers as instructed by the conductor.

## Status

🔄 **IN PROGRESS** - Basic worker implementation complete. Ready for testing.

## Features

- ✅ Self-registration with conductor using registration token
- ✅ Automatic resource detection (CPU, RAM, disk, network)
- ✅ Heartbeat mechanism to maintain connection with conductor
- ✅ Resource reporting to conductor
- ✅ Health check and status endpoints
- ✅ Automatic re-registration on connection loss
- ⏳ Docker container management (coming soon)
- ⏳ Service deployment handling (coming soon)

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
CONDUCTOR_URL=http://localhost:3000
CONDUCTOR_TOKEN=<token-from-conductor>
PORT=3001
```

**Note:** All device info (hostname, IP, CPU, RAM, disk) is automatically detected by the entrypoint script. No manual configuration needed! For macOS Docker users, run `./detect-host-resources.sh` before starting for best results.

4. **For macOS Docker users (optional but recommended):**
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
docker-compose up --build
```

**Note**: Make sure the `aerekos-network` network exists:
```bash
docker network create aerekos-network
```

## Configuration

### Environment Variables

**Required:**
- `CONDUCTOR_URL` - Conductor API URL (default: `http://localhost:3000`)
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
4. **Receives** deployment instructions from conductor (coming soon)
5. **Executes** Docker containers for services (coming soon)
6. **Reports** service status back to conductor (coming soon)

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

