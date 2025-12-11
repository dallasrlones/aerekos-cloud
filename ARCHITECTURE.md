# Architecture Overview

## Docker Compose Structure

Each component has its own `docker-compose.yml` file:

### 1. Conductor (`conductor/docker-compose.yml`)
- **Conductor API** - Master orchestrator
- **Frontend** - React Native dashboard
- Runs on port 3000 (API) and 19006 (Frontend)

### 2. Worker (`worker/docker-compose.yml`)
- **Primary Worker Container** - Manages services and communicates with conductor
- Runs on port 3001
- Uses `worker/.env` for configuration:
  - `CONDUCTOR_URL` - Conductor API URL
  - `CONDUCTOR_TOKEN` - Registration token from conductor

### 3. Services (`worker/[service_name]/docker-compose.yml`)
- Each service has its own `docker-compose.yml`
- Each service is an API that communicates with the worker container
- Examples:
  - `worker/key_manager/docker-compose.yml`
  - `worker/storage_manager/docker-compose.yml`
  - `worker/db_manager/docker-compose.yml`

## Communication Flow

```
Service APIs → Worker Container → Conductor Container
```

1. **Service APIs** talk to **Worker Container**
2. **Worker Container** talks to **Conductor Container**
3. **Conductor Container** orchestrates everything

## Setup Flow

### Step 1: Start Conductor
```bash
cd conductor
cp .env_example .env
# Edit .env: JWT_SECRET=<random-string>
docker-compose up --build
```

### Step 2: Get Registration Token
- Open http://localhost:19006
- Login → Settings → Copy registration token

### Step 3: Start Worker
```bash
cd worker
cp .env_example .env
# Edit .env:
#   CONDUCTOR_URL=http://localhost:3000  (or http://conductor:3000 if conductor is in Docker)
#   CONDUCTOR_TOKEN=<token-from-step-2>
docker-compose up --build
```

### Step 4: Start Services (as they're implemented)
```bash
cd worker/[service_name]
docker-compose up --build
```

## Network Configuration

- **Conductor**: Uses `aerekos-cloud-network`
- **Worker**: Uses `aerekos-network` (can connect to conductor via host network or shared network)
- **Services**: Each service can use its own network or connect to worker's network

## Key Points

- ✅ Each component has its own docker-compose.yml
- ✅ Worker uses `worker/.env` (not root `.env`)
- ✅ Services communicate through Worker Container
- ✅ Worker Container communicates with Conductor Container
- ✅ Conductor and Worker can run on same device
- ✅ Each service is independently deployable

