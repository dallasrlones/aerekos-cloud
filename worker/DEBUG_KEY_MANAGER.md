# Debugging Key Manager Container Deployment

This guide helps debug why key_manager container isn't starting.

## Quick Diagnosis Steps

### 1. Run the Test Script

```bash
cd worker
node scripts/test-key-manager-deployment.js
```

This script will:
- Check Docker connection
- Verify key_manager directory structure
- Check for existing containers
- Try to build the image
- Try to start the container
- Show container logs and health

### 2. Check Worker Logs

Look for deployment-related messages in worker logs:

```bash
# If running via docker-compose
docker-compose logs worker | grep -i "key_manager\|deployment"

# Or if running directly
# Check worker console output for:
# - "Received deployment instruction"
# - "Deploying service: key_manager"
# - "Building Docker image"
# - Any error messages
```

### 3. Check Conductor Logs

Check if conductor is sending deployment instructions:

```bash
docker-compose logs conductor | grep -i "key_manager\|deployment"
```

### 4. Manual Container Check

```bash
# List all containers
docker ps -a | grep key_manager

# Check container logs
docker logs aerekos-key_manager

# Check container status
docker inspect aerekos-key_manager | grep -A 10 "State"

# Try to start manually
docker start aerekos-key_manager
```

### 5. Manual Image Build

Try building the image manually to see build errors:

```bash
cd worker/key_manager

# Build with Dockerfile.dev
docker build -f Dockerfile.dev -t aerekos-key_manager:latest \
  --build-arg BUILD_CONTEXT=key_manager \
  -t aerekos-key_manager:latest \
  ../

# Check build output for errors
```

## Common Issues

### Issue 1: Image Not Found

**Symptoms**: Error like "Image aerekos-key_manager:latest not found"

**Solution**:
1. Check if Dockerfile.dev exists in `worker/key_manager/`
2. Check if aerekos-record exists in `worker/services/aerekos-record/`
3. Try building manually (see above)
4. Check build logs for errors

### Issue 2: Container Fails to Start

**Symptoms**: Container created but exits immediately

**Solution**:
1. Check container logs: `docker logs aerekos-key_manager`
2. Check environment variables are set correctly
3. Check if port 3002 is already in use: `lsof -i :3002`
4. Check if CONDUCTOR_URL is accessible from container

### Issue 3: Deployment Instruction Not Received

**Symptoms**: Worker doesn't receive deployment instruction

**Solution**:
1. Check WebSocket connection: Look for "Socket connected" in worker logs
2. Check conductor is sending instructions: Look in conductor logs
3. Check worker is registered: `GET http://localhost:3000/api/workers`
4. Try enabling service via API: `POST http://localhost:3000/api/services/key_manager/enable`

### Issue 4: Network Issues

**Symptoms**: Container starts but can't connect to conductor

**Solution**:
1. Check network: `docker network ls | grep aerekos`
2. Check container is on correct network: `docker inspect aerekos-key_manager | grep NetworkMode`
3. Check CONDUCTOR_URL from inside container: `docker exec aerekos-key_manager env | grep CONDUCTOR`
4. Try pinging conductor from container: `docker exec aerekos-key_manager wget -O- http://host.docker.internal:3000/health`

### Issue 5: Permission Issues

**Symptoms**: Container can't write to mounted volumes

**Solution**:
1. Check volume mount permissions: `ls -la worker/key_manager/data`
2. Check Docker socket access: Worker container needs `/var/run/docker.sock` mounted
3. Check file permissions in key_manager directory

## Testing the Full Flow

### Test 1: Manual Deployment

```bash
cd worker
node scripts/test-deployment-flow.js
```

### Test 2: Via Conductor API

```bash
# Enable service via conductor API
curl -X POST http://localhost:3000/api/services/key_manager/enable \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check service status
curl http://localhost:3000/api/services/key_manager/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test 3: Check Service Registration

```bash
# Check if key_manager registered with conductor
curl http://localhost:3000/api/services/key_manager \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check worker received deployment instruction
# Look in worker logs for "Received deployment instruction"
```

## Debugging Checklist

- [ ] Docker daemon is running and accessible
- [ ] Worker container has Docker socket mounted (`/var/run/docker.sock`)
- [ ] Worker is registered with conductor
- [ ] WebSocket connection is established between worker and conductor
- [ ] key_manager directory exists with Dockerfile.dev
- [ ] aerekos-record service exists in `worker/services/aerekos-record/`
- [ ] Port 3002 is not already in use
- [ ] CONDUCTOR_URL is set correctly in environment
- [ ] Service is enabled in conductor (`POST /api/services/key_manager/enable`)
- [ ] Deployment instruction is being sent from conductor
- [ ] Deployment instruction is being received by worker
- [ ] Image builds successfully
- [ ] Container starts successfully
- [ ] Container can connect to conductor
- [ ] Service registers with conductor after starting

## Getting Help

If you're still stuck:

1. Run the test script and save the output
2. Check all logs (worker, conductor, container)
3. Check container status: `docker inspect aerekos-key_manager`
4. Check network connectivity
5. Verify environment variables

## Next Steps After Fixing

Once key_manager is running:

1. Verify it registered: `GET /api/services/key_manager`
2. Test health endpoint: `GET http://localhost:3002/health`
3. Test API: `GET http://localhost:3000/api/services/key_manager/api/keys`
4. Create a test key: `POST http://localhost:3000/api/services/key_manager/api/keys`
