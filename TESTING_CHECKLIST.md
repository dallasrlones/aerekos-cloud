# Testing Checklist - Worker Registration

## Pre-Test Setup

### ✅ Conductor Setup
- [ ] `cd conductor`
- [ ] `cp .env_example .env`
- [ ] Edit `.env`: Set `JWT_SECRET` to a random string
- [ ] `docker-compose up --build`
- [ ] Wait for conductor to start (check logs)
- [ ] Verify conductor health: `curl http://localhost:3000/health`

### ✅ Get Registration Token
- [ ] Open http://localhost:19006 in browser
- [ ] Login: `admin` / `admin`
- [ ] Navigate to Settings (`/settings`)
- [ ] Click eye icon to show registration token
- [ ] Copy the token

### ✅ Worker Setup
- [ ] `cd worker`
- [ ] `cp .env_example .env`
- [ ] Edit `.env`:
  - [ ] Set `CONDUCTOR_URL`:
    - If conductor is running locally: `http://localhost:3000`
    - If conductor is in Docker and worker is local: `http://localhost:3000`
    - If both are in Docker: `http://host.docker.internal:3000` (Mac/Windows) or `http://172.17.0.1:3000` (Linux)
  - [ ] Set `CONDUCTOR_TOKEN` to the token from Settings
- [ ] `docker-compose up --build`

## Test Steps

### 1. Verify Worker Registration
- [ ] Check worker logs for: `✓ Worker registered successfully!`
- [ ] Verify worker ID, hostname, and IP are displayed
- [ ] Check conductor logs for registration request

### 2. Verify Worker Appears in Frontend
- [ ] Open http://localhost:19006/devices
- [ ] Worker should appear in the list
- [ ] Status should be "online"
- [ ] Resources should be displayed (CPU, RAM, disk)

### 3. Verify Worker Details
- [ ] Click on worker in devices list
- [ ] Verify all details are displayed:
  - [ ] Hostname
  - [ ] IP Address
  - [ ] Status: "online"
  - [ ] Resources (CPU, RAM, disk, network)
  - [ ] Last seen timestamp

### 4. Verify Heartbeat
- [ ] Wait 30 seconds (heartbeat interval)
- [ ] Check worker logs for heartbeat messages
- [ ] Check conductor logs for heartbeat requests
- [ ] Verify "last seen" timestamp updates in frontend

### 5. Verify Resource Reporting
- [ ] Wait 60 seconds (resource check interval)
- [ ] Check worker logs for resource update messages
- [ ] Check conductor logs for resource update requests
- [ ] Verify resources are updated in frontend

## Troubleshooting

### Worker Can't Connect to Conductor
- Check `CONDUCTOR_URL` in worker `.env`
- If conductor is local and worker is Docker: use `http://host.docker.internal:3000`
- If both are Docker: ensure they're on same network or use `http://host.docker.internal:3000`
- Check conductor is running: `curl http://localhost:3000/health`

### Worker Registration Fails
- Verify `CONDUCTOR_TOKEN` is correct (copy from Settings)
- Check token hasn't been regenerated
- Check conductor logs for error messages
- Verify conductor is accessible from worker

### Worker Not Appearing in Frontend
- Refresh `/devices` page
- Check conductor API: `curl http://localhost:3000/api/workers` (requires auth token)
- Verify worker is sending heartbeats (check worker logs)
- Check browser console for errors

## Success Criteria

✅ Worker registers successfully with conductor
✅ Worker appears in `/devices` screen
✅ Worker status is "online"
✅ Worker resources are displayed
✅ Heartbeats are working (last_seen updates)
✅ Resource reporting is working (resources update)

