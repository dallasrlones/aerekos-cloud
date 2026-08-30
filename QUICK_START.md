# Quick Start Guide

## Architecture

Each component has its own `docker-compose.yml`:
- **Conductor**: `conductor/docker-compose.yml` (conductor + frontend)
- **Worker**: `worker/docker-compose.yml` (primary worker container)
- **Services**: `worker/[service_name]/docker-compose.yml` (each service)

**Communication Flow**: Service APIs → Worker Container → Conductor Container

## Testing Conductor + Worker

### Step 1: Setup Conductor

```bash
cd conductor
cp .env_example .env
# Edit .env and add: JWT_SECRET=<any-random-string>
docker-compose up --build
```

Wait for services to start (check logs).

### Step 2: Get Registration Token

1. Open http://localhost:19006 in browser
2. Login: `admin` / `admin`
3. Go to Settings → View registration token (click eye icon)
4. Copy the token

### Step 3: Setup Worker

```bash
cd worker
cp .env_example .env
# Edit .env:
#   CONDUCTOR_URL=http://localhost:3000  (or http://host.docker.internal:3000 if conductor is in Docker)
#   CONDUCTOR_TOKEN=<paste-your-token-here>
#   WORKER_HOSTNAME=<your-device-hostname>  # Optional but recommended (run `hostname` to find it)
#   WORKER_IP=<your-device-ip>  # Optional but recommended (run `ifconfig` to find it)
docker-compose up --build
```

**Note:** If `WORKER_HOSTNAME` and `WORKER_IP` are not set, the worker will try to auto-detect them, but it's recommended to set them explicitly for accurate device identification.

### Step 4: Verify Connection

- Check http://localhost:19006/devices - worker should appear
- Check worker logs: `docker-compose logs worker` (from worker directory)
- Check conductor logs: `docker-compose logs conductor` (from conductor directory)

---

## Summary

**Conductor:**
1. `cd conductor`
2. Create `.env` with `JWT_SECRET`
3. `docker-compose up --build`

**Worker:**
1. `cd worker`
2. Create `.env` with `CONDUCTOR_URL` and `CONDUCTOR_TOKEN`
3. `docker-compose up --build`

**Note:** Each component uses its own `.env` file in its own directory!

