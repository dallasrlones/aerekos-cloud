# Testing Key Manager Container Deployment

## Quick Test

Run the comprehensive test script:

```bash
cd worker
./scripts/quick-test-key-manager.sh
```

Or use the Node.js diagnostic script:

```bash
cd worker
node scripts/test-key-manager-deployment.js
```

## What to Test

### 1. Manual Container Start Test

This tests if the container can start independently:

```bash
cd worker
node scripts/test-key-manager-deployment.js
```

**Expected Output**:
- ✓ Docker connection OK
- ✓ key_manager directory found
- ✓ Image built or found
- ✓ Container started
- ✓ Health endpoint responds

### 2. Full Deployment Flow Test

This tests the complete conductor → worker → container flow:

```bash
cd worker
node scripts/test-deployment-flow.js
```

**Expected Output**:
- Deployment instruction processed
- Container created and started
- Container status shows "running"

### 3. Via Conductor API

Test enabling service through conductor:

```bash
# Enable service
curl -X POST http://localhost:3000/api/services/key_manager/enable \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check status
curl http://localhost:3000/api/services/key_manager/status \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check if service registered
curl http://localhost:3000/api/services/key_manager \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## What to Check

### Worker Logs

Look for these messages:

```
[Socket] Received deployment instruction: deploy for key_manager
Deploying service: key_manager
Building Docker image aerekos-key_manager:latest...
✓ Successfully built image aerekos-key_manager:latest
✓ Service key_manager deployed successfully
```

### Container Status

```bash
# Check if container exists and is running
docker ps -a | grep key_manager

# Should show:
# aerekos-key_manager   ...   Up X seconds   ...   0.0.0.0:3002->3002/tcp
```

### Container Logs

```bash
docker logs aerekos-key_manager

# Should show:
# [key_manager] Starting key manager service...
# [key_manager] Using SQLite fallback database
# [key_manager] Registering with conductor...
# [key_manager] Successfully registered: <service_id>
# [key_manager] Server running on port 3002
```

### Health Endpoint

```bash
curl http://localhost:3002/health

# Should return:
# {
#   "status": "healthy",
#   "service": "key_manager",
#   "timestamp": "..."
# }
```

### Service Registration

```bash
curl http://localhost:3000/api/services/key_manager

# Should return service details including:
# - service_id
# - name: "key_manager"
# - enabled: true
# - instances array with worker info
```

## Common Problems & Solutions

### Problem: "Image not found"

**Solution**: The build process should create it automatically. Check:
1. Dockerfile.dev exists in `worker/key_manager/`
2. aerekos-record exists in `worker/services/aerekos-record/`
3. Build logs show no errors

### Problem: "Container exits immediately"

**Solution**: Check logs:
```bash
docker logs aerekos-key_manager
```

Common causes:
- Missing CONDUCTOR_URL environment variable
- Port 3002 already in use
- Service registration fails
- Database initialization fails

### Problem: "Deployment instruction not received"

**Solution**: Check:
1. Worker is registered: `GET /api/workers`
2. WebSocket connection: Look for "Socket connected" in worker logs
3. Service is enabled: `POST /api/services/key_manager/enable`

### Problem: "Build fails"

**Solution**: Check build context:
1. Verify directory structure matches expected layout
2. Check Dockerfile.dev COPY commands match structure
3. Verify aerekos-record is accessible

## Success Criteria

✅ Container is running: `docker ps | grep key_manager`  
✅ Health endpoint works: `curl http://localhost:3002/health`  
✅ Service registered: `GET /api/services/key_manager` shows service  
✅ Can create keys: `POST /api/services/key_manager/api/keys`  
✅ Logs show no errors: `docker logs aerekos-key_manager`  

## Next Steps After Success

Once key_manager is running:

1. **Test key creation**:
   ```bash
   curl -X POST http://localhost:3000/api/services/key_manager/api/keys \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{"name": "test-key", "type": "symmetric"}'
   ```

2. **Test key retrieval**:
   ```bash
   curl http://localhost:3000/api/services/key_manager/api/keys/test-key \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

3. **Verify storage_manager can use it**:
   - Set `MOCK_KEY_MANAGER=false` in storage_manager
   - Test encryption operations

## Debugging Tips

1. **Always check logs first**: `docker logs aerekos-key_manager`
2. **Check container state**: `docker inspect aerekos-key_manager`
3. **Verify environment variables**: `docker exec aerekos-key_manager env`
4. **Test network connectivity**: `docker exec aerekos-key_manager wget -O- http://host.docker.internal:3000/health`
5. **Check port binding**: `docker port aerekos-key_manager`

## Getting Help

If you're stuck:
1. Run the diagnostic script and save output
2. Collect logs (worker, conductor, container)
3. Check container inspect output
4. Verify all prerequisites are met
