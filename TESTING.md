# Testing Guide

This guide explains how to test the aerekos-cloud system, including worker registration on the same device as the conductor.

## Current Status

### ✅ Completed Features

**Conductor:**
- ✅ Backend API (authentication, token management, worker management)
- ✅ Frontend dashboard (login, dashboard, settings, devices list, device details)
- ✅ Worker registration with IP/hostname detection
- ✅ All 76 tests passing

**Worker:**
- ✅ Worker registration (simplified - only needs CONDUCTOR_URL and CONDUCTOR_TOKEN)
- ✅ Automatic resource detection
- ✅ Heartbeat mechanism
- ✅ Resource reporting
- ✅ Docker container management
- ✅ Service deployment handling
- ✅ Test suite (unit and integration tests)

## Testing Worker Registration (Same Device)

### Prerequisites

1. **Docker and Docker Compose** installed
2. **Network access** for ports 3000, 3001, 19006

### Option A: Docker Compose (Recommended - Everything Dockerized)

**Start all services:**
```bash
# From root directory
cp .env_example .env

# Setup conductor .env
cd conductor
cp .env_example .env
# Edit .env with JWT_SECRET
cd ..

# Start conductor and frontend
docker-compose up --build

# Get registration token (see below)
# Add WORKER_TOKEN=<token> to root .env

# Start worker
docker-compose up -d worker
```

**Get Registration Token:**
1. Open http://localhost:19006 in Chrome
2. Login: `admin` / `admin`
3. Go to Settings → View token
4. Copy token to root `.env` as `WORKER_TOKEN=<token>`
5. Restart worker: `docker-compose restart worker`

### Option B: Local Development (Node.js)

**Prerequisites:**
1. **Conductor running** on port 3000
2. **Node.js 18+** installed
3. **Docker** installed (for container management features)

### Step 1: Start Conductor (Local Development)

```bash
cd conductor
npm install
cp .env_example .env
# Edit .env with your JWT_SECRET
npm start
# Or: npm run dev (for auto-restart)
```

The conductor will:
- Generate a registration token automatically
- Start API server on port 3000
- Start frontend separately (or use docker-compose for frontend)

### Step 2: Get Registration Token

**Option A: Via Frontend (Recommended)**
1. Open browser to `http://localhost:19006` (or your frontend URL)
2. Login with default credentials (admin/admin)
3. Navigate to Settings (`/settings`)
4. View registration token (click eye icon to show/hide)
5. Copy the token

**Option B: Via API**
```bash
# Login first to get auth token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'

# Use the returned token to get registration token
curl http://localhost:3000/api/token \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

### Step 3: Configure Worker

```bash
cd worker
npm install
cp .env_example .env
```

Edit `.env`:
```bash
CONDUCTOR_URL=http://localhost:3000
CONDUCTOR_TOKEN=<paste-token-from-step-2>
PORT=3001
```

**Note:** That's it! No need to set WORKER_HOSTNAME or WORKER_IP - conductor will detect them automatically.

### Step 4: Start Worker

```bash
npm start
# Or: npm run dev (for auto-restart)
```

You should see:
```
Worker API server running on port 3001
Registering worker with conductor at http://localhost:3000...
✓ Worker registered successfully!
  Worker ID: <worker-id>
  Hostname: <detected-hostname>
  IP Address: <detected-ip>
  Status: online
  Resources: X CPU cores, Y GB RAM, Z GB disk
Heartbeat loop started (interval: 30s)
Resource check loop started (interval: 60s)
```

### Step 5: Verify Registration

**Option A: Via Frontend**
1. Navigate to `/devices` in the frontend
2. You should see your worker listed with status "online"
3. Click on the worker to see details

**Option B: Via API**
```bash
# List all workers (requires auth token)
curl http://localhost:3000/api/workers \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"

# Get specific worker
curl http://localhost:3000/api/workers/<worker-id> \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

**Option C: Check Worker Health**
```bash
curl http://localhost:3001/health
curl http://localhost:3001/status
```

## Running Tests

### Conductor Tests

```bash
cd conductor
npm test
```

Expected: **76 tests passing** (4 test suites)

### Worker Tests

```bash
cd worker
npm install  # Install jest and supertest if not already installed
npm test
```

Expected: Unit tests and integration tests passing

## Testing Flow Summary

1. ✅ Start conductor → generates token
2. ✅ Get token from Settings screen (or API)
3. ✅ Configure worker `.env` with only `CONDUCTOR_URL` and `CONDUCTOR_TOKEN`
4. ✅ Start worker → auto-registers
5. ✅ Conductor detects IP/hostname from request
6. ✅ Worker stores IP/hostname in memory
7. ✅ View devices in `/devices` screen
8. ✅ View device details in `/devices/:id` screen
9. ✅ Worker sends heartbeats every 30 seconds
10. ✅ Worker reports resources every 60 seconds

## Testing Same-Device Setup

Since conductor and worker can run on the same device:

1. **Conductor** runs on port **3000**
2. **Worker** runs on port **3001**
3. Both can access the same Docker daemon
4. Worker registers with `CONDUCTOR_URL=http://localhost:3000`
5. Conductor detects worker's IP as `127.0.0.1` or actual network IP

## Troubleshooting

### Worker fails to register
- Check `CONDUCTOR_TOKEN` is correct
- Check `CONDUCTOR_URL` is accessible
- Check conductor logs for errors
- Verify token hasn't been regenerated

### Worker not showing in frontend
- Refresh the `/devices` page
- Check conductor API: `GET /api/workers`
- Verify worker is sending heartbeats (check worker logs)

### IP detection issues
- Ensure conductor has `trust proxy` enabled (already done)
- Check network configuration
- For Docker, ensure proper network setup

## Next Steps for Live Testing

After running tests:

1. ✅ Run all tests: `npm test` in both conductor and worker
2. ✅ Test worker registration manually (steps above)
3. ✅ Test frontend in Chrome:
   - Login
   - View registration token in Settings
   - Register worker
   - View devices list
   - View device details
   - Verify heartbeats are updating

## Notes

- Worker IP/hostname are stored **in memory only** - will be re-detected on restart
- Registration token can be regenerated from Settings screen
- Worker automatically re-registers if connection is lost
- Both conductor and worker can run on the same device (single-server setup)

