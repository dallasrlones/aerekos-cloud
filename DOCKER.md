# Docker Setup Guide

Everything in aerekos-cloud is dockerized and can run together on the same device.

## Quick Start (All Services)

### Prerequisites
- Docker and Docker Compose installed
- Network access for ports 3000, 3001, 19006

### Step 1: Setup Environment

```bash
# Copy root .env_example
cp .env_example .env

# Setup conductor .env
cd conductor
cp .env_example .env
# Edit .env with JWT_SECRET
cd ..
```

### Step 2: Start All Services

```bash
# Start conductor and frontend
docker-compose up --build

# In another terminal, get registration token
# (See "Getting Registration Token" below)

# Then update root .env with WORKER_TOKEN
# Edit .env and add: WORKER_TOKEN=<your-token>

# Restart to include worker
docker-compose up -d worker
```

### Step 3: Access Services

- **Conductor API**: http://localhost:3000
- **Frontend**: http://localhost:19006
- **Worker API**: http://localhost:3001

## Getting Registration Token

### Option 1: Via Frontend (Recommended)
1. Open http://localhost:19006
2. Login: `admin` / `admin`
3. Go to Settings
4. View registration token (click eye icon)
5. Copy token

### Option 2: Via API
```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'

# Get token (use auth token from login)
curl http://localhost:3000/api/token \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

Then add `WORKER_TOKEN=<token>` to root `.env` and restart worker:
```bash
docker-compose restart worker
```

## Service-Specific Docker Compose

### Conductor Only
```bash
cd conductor
docker-compose up --build
```

### Worker Only (Standalone)
```bash
cd worker
# Create .env with CONDUCTOR_URL and CONDUCTOR_TOKEN
docker-compose up --build
```

## Development Mode

All services support development mode with hot-reload:

- **Conductor**: Uses `Dockerfile.dev` with nodemon
- **Frontend**: Uses `Dockerfile.dev` with Expo dev server
- **Worker**: Uses `Dockerfile.dev` with nodemon

Code changes are automatically detected and services restart.

## Production Mode

For production, use production Dockerfiles:

```bash
# Build with production Dockerfiles
docker-compose -f docker-compose.yml build \
  --build-arg DOCKERFILE=Dockerfile

# Or modify docker-compose.yml to use Dockerfile instead of Dockerfile.dev
```

## Network Configuration

All services use the `aerekos-cloud-network` bridge network:
- Conductor: `http://conductor:3000` (internal)
- Worker: `http://conductor:3000` (internal) or `http://localhost:3000` (host)
- Frontend: `http://localhost:3000` (host)

## Volume Mounts

**Conductor:**
- `./conductor/data` → Database storage
- `./conductor/api` → API code (for hot-reload)
- `./conductor/scripts` → Scripts (for hot-reload)

**Frontend:**
- `./conductor/app` → Frontend code (for hot-reload)

**Worker:**
- `./worker` → Worker code (for hot-reload)
- `/var/run/docker.sock` → Docker daemon access

## Health Checks

All services have health checks:
- Conductor: `GET /health`
- Worker: `GET /health`
- Frontend: Expo dev server

## Troubleshooting

### Worker can't connect to conductor
- Check `CONDUCTOR_URL` in worker environment
- Use `http://conductor:3000` for Docker network
- Use `http://localhost:3000` for host network

### Worker registration fails
- Verify `WORKER_TOKEN` is set correctly
- Check conductor logs: `docker-compose logs conductor`
- Check worker logs: `docker-compose logs worker`

### Port conflicts
- Change ports in `.env`:
  - `CONDUCTOR_PORT=3000`
  - `WORKER_PORT=3001`
  - `FRONTEND_PORT=19006`

### Docker socket permission denied
- Ensure Docker socket is accessible: `ls -la /var/run/docker.sock`
- May need to add user to docker group: `sudo usermod -aG docker $USER`

## Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f conductor
docker-compose logs -f worker
docker-compose logs -f frontend
```

## Stopping Services

```bash
# Stop all
docker-compose down

# Stop specific service
docker-compose stop worker

# Stop and remove volumes
docker-compose down -v
```

