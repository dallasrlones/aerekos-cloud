# Key Manager Container Deployment Troubleshooting

## Quick Start - Run Diagnostic Script

```bash
cd worker
node scripts/test-key-manager-deployment.js
```

This will check everything and show you exactly what's wrong.

## Common Issues & Solutions

### Issue 1: Missing tar-fs Dependency

**Symptoms**: Error like "Cannot find module 'tar-fs'"

**Solution**:
```bash
cd worker
npm install tar-fs
```

### Issue 2: Docker Socket Not Accessible

**Symptoms**: Error like "Cannot connect to Docker daemon"

**Solution**:
1. Ensure Docker is running: `docker ps`
2. Check worker container has socket mounted:
   ```yaml
   volumes:
     - /var/run/docker.sock:/var/run/docker.sock
   ```
3. Check permissions: `ls -la /var/run/docker.sock`

### Issue 3: Image Build Fails

**Symptoms**: Build errors when creating image

**Check**:
1. Verify key_manager directory exists: `ls -la worker/key_manager`
2. Verify Dockerfile.dev exists: `ls -la worker/key_manager/Dockerfile.dev`
3. Verify aerekos-record exists: `ls -la worker/services/aerekos-record`
4. Try manual build:
   ```bash
   cd worker
   docker build -f key_manager/Dockerfile.dev \
     --build-arg BUILD_CONTEXT=key_manager \
     -t aerekos-key_manager:latest \
     .
   ```

### Issue 4: Container Starts But Exits Immediately

**Symptoms**: Container created but status shows "Exited"

**Debug**:
```bash
# Check logs
docker logs aerekos-key_manager

# Common causes:
# - Missing CONDUCTOR_URL
# - Port already in use
# - Missing MASTER_KEY
# - Service registration fails
```

### Issue 5: Deployment Instruction Not Received

**Symptoms**: Worker doesn't start container after enabling service

**Check**:
1. Verify worker is registered:
   ```bash
   curl http://localhost:3000/api/workers
   ```

2. Verify WebSocket connection:
   - Look for "Socket connected" in worker logs
   - Check conductor logs for WebSocket connections

3. Manually trigger deployment:
   ```bash
   # Enable service via API
   curl -X POST http://localhost:3000/api/services/key_manager/enable \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

4. Check worker receives instruction:
   - Look for "Received deployment instruction" in worker logs
   - Check deployment queue: Worker should process instruction

### Issue 6: Network Issues

**Symptoms**: Container can't reach conductor

**Check**:
```bash
# Check container network
docker inspect aerekos-key_manager | grep NetworkMode

# Should be: "worker_aerekos-network" or similar

# Test connectivity from container
docker exec aerekos-key_manager wget -O- http://host.docker.internal:3000/health

# Check CONDUCTOR_URL
docker exec aerekos-key_manager env | grep CONDUCTOR
```

## Step-by-Step Debugging

### Step 1: Verify Prerequisites

```bash
# 1. Docker is running
docker ps

# 2. Worker is running
docker ps | grep worker

# 3. Conductor is running
docker ps | grep conductor

# 4. Worker is registered
curl http://localhost:3000/api/workers | jq
```

### Step 2: Check Service Configuration

```bash
# Check if service exists in conductor
curl http://localhost:3000/api/services/key_manager | jq

# Check service status
curl http://localhost:3000/api/services/key_manager/status | jq
```

### Step 3: Enable Service

```bash
# Enable via API
curl -X POST http://localhost:3000/api/services/key_manager/enable \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" | jq
```

### Step 4: Check Worker Logs

```bash
# Watch worker logs for deployment
docker-compose logs -f worker | grep -i "key_manager\|deployment"
```

### Step 5: Check Container Status

```bash
# List containers
docker ps -a | grep key_manager

# Check container details
docker inspect aerekos-key_manager | jq '.[0].State'

# Check container logs
docker logs aerekos-key_manager --tail 100
```

### Step 6: Test Container Manually

```bash
# If container exists but stopped, try starting manually
docker start aerekos-key_manager

# Check logs immediately
docker logs aerekos-key_manager --tail 50 -f
```

## Manual Testing

### Test 1: Build Image Manually

```bash
cd worker

# Create build context
mkdir -p /tmp/test-build/key_manager
mkdir -p /tmp/test-build/services

# Copy files
cp -r key_manager/* /tmp/test-build/key_manager/
cp -r services/aerekos-record /tmp/test-build/services/
cp key_manager/Dockerfile.dev /tmp/test-build/

# Build
cd /tmp/test-build
docker build -f Dockerfile.dev -t aerekos-key_manager:test .
```

### Test 2: Run Container Manually

```bash
docker run -d \
  --name aerekos-key_manager-test \
  -p 3002:3002 \
  -e CONDUCTOR_URL=http://host.docker.internal:3000 \
  -e SERVICE_NAME=key_manager \
  -e PORT=3002 \
  -e NODE_ENV=development \
  -e MASTER_KEY=dev-master-key-test \
  -v $(pwd)/worker/key_manager/data:/app/data \
  --network worker_aerekos-network \
  aerekos-key_manager:test

# Check logs
docker logs -f aerekos-key_manager-test
```

### Test 3: Test Service Registration

```bash
# Wait a few seconds for service to start
sleep 5

# Check if service registered
curl http://localhost:3000/api/services/key_manager | jq

# Test health endpoint
curl http://localhost:3002/health | jq
```

## Expected Flow

1. **Conductor**: Service enabled via API
2. **Conductor**: Creates deployment instruction
3. **Conductor**: Sends instruction to worker via WebSocket
4. **Worker**: Receives instruction via WebSocket handler
5. **Worker**: Queues instruction in DeploymentHandler
6. **Worker**: Processes queue (deployService)
7. **Worker**: Checks for docker-compose.yml (not found)
8. **Worker**: Uses ServiceManager.startService
9. **Worker**: Checks if image exists
10. **Worker**: Builds image if needed (buildServiceImage)
11. **Worker**: Creates container config
12. **Worker**: Creates and starts container
13. **Worker**: Reports success to conductor
14. **key_manager**: Container starts
15. **key_manager**: Service registers with conductor
16. **key_manager**: Health endpoint becomes available

## Log Locations

- **Worker logs**: `docker-compose logs worker`
- **Conductor logs**: `docker-compose logs conductor`
- **key_manager logs**: `docker logs aerekos-key_manager`
- **Docker daemon logs**: Check Docker Desktop or system logs

## Getting More Help

If still stuck, collect this information:

1. Output of diagnostic script: `node scripts/test-key-manager-deployment.js`
2. Worker logs: `docker-compose logs worker > worker.log`
3. Conductor logs: `docker-compose logs conductor > conductor.log`
4. Container logs: `docker logs aerekos-key_manager > key_manager.log`
5. Container inspect: `docker inspect aerekos-key_manager > inspect.json`
6. Docker info: `docker info > docker-info.txt`

## Quick Fixes

### Fix 1: Reinstall tar-fs
```bash
cd worker
npm install tar-fs
```

### Fix 2: Rebuild Worker Container
```bash
docker-compose build worker
docker-compose up -d worker
```

### Fix 3: Clean Up and Retry
```bash
# Stop and remove container
docker stop aerekos-key_manager 2>/dev/null
docker rm aerekos-key_manager 2>/dev/null

# Remove image
docker rmi aerekos-key_manager:latest 2>/dev/null

# Retry deployment
curl -X POST http://localhost:3000/api/services/key_manager/enable
```

### Fix 4: Check Port Availability
```bash
# Check if port 3002 is in use
lsof -i :3002

# If in use, stop the process or change port
```
