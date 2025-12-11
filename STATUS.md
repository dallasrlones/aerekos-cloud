# Current Status & Testing Guide

## 🎯 Where We're At

### ✅ Completed Features

**Conductor (Backend):**
- ✅ Authentication system (login, JWT tokens)
- ✅ User management (password reset, profile update)
- ✅ Registration token generation and management
- ✅ Worker registration API (with IP/hostname auto-detection)
- ✅ Worker heartbeat and resource reporting APIs
- ✅ All 76 tests passing ✅

**Conductor (Frontend):**
- ✅ Login screen
- ✅ Dashboard with health status
- ✅ Settings screen with:
  - Profile editing (username, email)
  - Password reset
  - **Registration token display with hide/show toggle** ✨
- ✅ Devices list screen (`/devices`)
- ✅ Device details screen (`/devices/:id`)
- ✅ Global header navigation
- ✅ Menu screen with sign out
- ✅ URL-based routing for web

**Worker:**
- ✅ Simplified configuration (only needs CONDUCTOR_URL and CONDUCTOR_TOKEN)
- ✅ Automatic registration with conductor
- ✅ IP/hostname auto-detected by conductor (stored in memory)
- ✅ Resource detection (CPU, RAM, disk, network)
- ✅ Heartbeat mechanism (every 30 seconds)
- ✅ Resource reporting (every 60 seconds)
- ✅ Docker container management
- ✅ Service deployment handling
- ✅ Test suite (unit and integration tests)

## 🧪 How to Test Worker Registration

### Quick Test (Same Device)

**Terminal 1 - Start Conductor:**
```bash
cd conductor
npm install  # if not done
npm start
# Conductor runs on http://localhost:3000
# Frontend runs on http://localhost:19006 (if using docker-compose)
```

**Terminal 2 - Get Registration Token:**

**Option A: Via Frontend (Easiest)**
1. Open `http://localhost:19006` in Chrome
2. Login: `admin` / `admin`
3. Go to Settings (`/settings`)
4. Click eye icon to show registration token
5. Copy the token

**Option B: Via API**
```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'

# Get token (use the token from login response)
curl http://localhost:3000/api/token \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

**Terminal 3 - Start Worker:**
```bash
cd worker
npm install  # if not done
cp .env_example .env

# Edit .env - only need these two lines:
# CONDUCTOR_URL=http://localhost:3000
# CONDUCTOR_TOKEN=<paste-token-here>

npm start
```

**Expected Output:**
```
Worker API server running on port 3001
Registering worker with conductor at http://localhost:3000...
✓ Worker registered successfully!
  Worker ID: <id>
  Hostname: <detected-hostname>
  IP Address: <detected-ip>
  Status: online
  Resources: X CPU cores, Y GB RAM, Z GB disk
Heartbeat loop started (interval: 30s)
Resource check loop started (interval: 60s)
```

### Verify in Frontend

1. Go to `/devices` in Chrome
2. You should see your worker listed
3. Click on it to see details
4. Status should be "online"
5. Resources should be displayed

### Verify via API

```bash
# List workers (requires auth token)
curl http://localhost:3000/api/workers \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"

# Check worker health
curl http://localhost:3001/health
curl http://localhost:3001/status
```

## 🧪 Running All Tests

### Conductor Tests
```bash
cd conductor
npm test
# Or run in Docker:
docker-compose exec conductor npm test
```
**Expected:** 76 tests passing (4 test suites)

### Worker Tests
```bash
cd worker
npm install  # Install jest if needed
npm test
# Or run in Docker:
docker-compose exec worker npm test
```
**Expected:** Unit and integration tests passing

### Quick Docker Test Script
```bash
# Interactive script that sets everything up
./docker-test.sh
```
This script will:
1. Start conductor and frontend
2. Wait for services to be ready
3. Prompt you to get registration token
4. Start worker with the token
5. Verify everything is running

## 📋 Testing Checklist

Before testing in Chrome:

- [ ] Run conductor tests: `cd conductor && npm test`
- [ ] Run worker tests: `cd worker && npm test`
- [ ] Start conductor: `cd conductor && npm start`
- [ ] Get registration token from Settings page
- [ ] Configure worker `.env` with token
- [ ] Start worker: `cd worker && npm start`
- [ ] Verify worker registered successfully
- [ ] Check `/devices` page shows worker
- [ ] Check `/devices/:id` shows worker details
- [ ] Verify heartbeats are updating (check last_seen)

## 🌐 Testing in Chrome

1. **Start Conductor:**
   ```bash
   cd conductor
   npm start
   # Or use docker-compose for frontend
   ```

2. **Open Chrome:**
   - Navigate to `http://localhost:19006` (or your frontend URL)
   - Login with `admin` / `admin`

3. **Test Registration Token:**
   - Go to Settings (`/settings`)
   - View registration token (click eye to show/hide)
   - Copy token

4. **Register Worker:**
   - Configure worker `.env` with token
   - Start worker in separate terminal
   - Worker should register automatically

5. **View Devices:**
   - Navigate to `/devices`
   - See registered worker
   - Click worker to see details
   - Verify resources are displayed
   - Verify status is "online"

6. **Test Navigation:**
   - Use header icons to navigate
   - Test URL routing (back/forward buttons)
   - Test sign out redirects to `/login`

## 🔧 Same-Device Setup Notes

- Conductor runs on port **3000**
- Worker runs on port **3001**
- Both can run on the same machine
- Worker uses `CONDUCTOR_URL=http://localhost:3000`
- Conductor detects worker IP from request (usually `127.0.0.1` or actual network IP)
- Both can access the same Docker daemon

## 📝 Key Changes Made

1. **Worker Simplification:**
   - Removed `WORKER_HOSTNAME` and `WORKER_IP` from `.env`
   - Worker only needs `CONDUCTOR_URL` and `CONDUCTOR_TOKEN`
   - IP/hostname detected by conductor and stored in memory

2. **Frontend Devices Management:**
   - Added `/devices` screen to list all workers
   - Added `/devices/:id` screen for device details
   - Added registration token display in Settings
   - Token can be shown/hidden with eye icon

3. **Conductor IP Detection:**
   - Added `trust proxy` setting
   - Detects IP from `X-Forwarded-For`, `req.ip`, or `req.connection.remoteAddress`
   - Detects hostname from request headers

## 🚀 Ready for Live Testing!

Everything is implemented and tested. You can now:
1. Run all tests to verify everything works
2. Test worker registration manually
3. Test the full flow in Chrome
4. Verify devices appear in the frontend

