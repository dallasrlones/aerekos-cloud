# 🚀 db_manager Implementation - Start Here

## Quick Context

You're implementing Docker container creation for **db_manager** - a service that spawns database containers (PostgreSQL, MongoDB, etc.) with customizable ports, usernames, passwords, and resource limits.

**Current Status**: Database records are created, but containers are NOT actually spawned yet. You need to implement the Docker container creation logic.

## 📋 What You Need to Do

1. **Create InstanceService** - Uses dockerode to create/start/stop/delete Docker containers
2. **Create PostgreSQL Handler** - PostgreSQL-specific container configuration
3. **Update DatabaseService** - Integrate InstanceService to actually create containers
4. **Update API Routes** - Make start/stop/restart actually work

## Backup / restore

For backup and disaster recovery (control-plane DB + engine-native dumps), see **`BACKUP_RESTORE.md`** in this folder.

## 📚 Essential Files to Read First

### 1. Understand Container Creation Pattern
**Read**: `worker/docker/ServiceManager.js`
- Lines 1-100: Constructor, container naming, finding containers
- Lines 440-511: `buildContainerConfig()` - How to build Docker container config
- Lines 69-208: `startService()` - How to create and start containers
- **Key Pattern**: Uses dockerode directly, creates containers with proper config, handles errors

### 2. Current db_manager Implementation
**Read**: `worker/db_manager/api/services/DatabaseService.js`
- Current implementation creates database records but doesn't create containers
- Already has EncryptionService integration (uses key_manager)
- Generates credentials, encrypts them, stores in database

**Read**: `worker/db_manager/api/services/EncryptionService.js`
- Already implemented - uses key_manager for encryption
- Encrypts connection strings and passwords before storage

**Read**: `worker/db_manager/api/routes/databases.js`
- API routes accept username/password/port but don't use them yet
- Schema updated to accept custom credentials

### 3. Integration Examples
**Read**: `worker/storage_manager/api/services/EncryptionService.js`
- See how storage_manager uses key_manager
- Pattern: `GET /api/services/key_manager/api/keys/{keyName}` via conductor

**Read**: `worker/storage_manager/api/services/BucketService.js`
- See `ensureEncryptionKey()` - how to ensure key exists in key_manager

### 4. Implementation Plans
**Read**: `worker/db_manager/plan.md` - Complete implementation plan
**Read**: `worker/db_manager/IMPLEMENTATION_PLAN.md` - Detailed step-by-step guide
**Read**: `worker/db_manager/AGENT_PROMPT.md` - Comprehensive agent prompt (this file)

## 🎯 Implementation Checklist

### Phase 1: InstanceService (Core Docker Management)
- [ ] Create `api/services/InstanceService.js`
  - [ ] Constructor - Initialize dockerode with Docker socket
  - [ ] `createInstance(config)` - Create container using dockerode
  - [ ] `findAvailablePort(startPort)` - Find available port by querying Docker
  - [ ] `startInstance(containerName)` - Start container
  - [ ] `stopInstance(containerName)` - Stop container
  - [ ] `restartInstance(containerName)` - Restart container
  - [ ] `deleteInstance(containerName)` - Delete container and volumes
  - [ ] `getInstanceStatus(containerName)` - Get container status

**Pattern to Follow**: `worker/docker/ServiceManager.js`
- Use dockerode: `new Docker({ socketPath: '/var/run/docker.sock' })`
- Container naming: `aerekos-db-{database-name}`
- Volume naming: `aerekos-db-{database-name}-data`
- Network: Connect to worker's network (detect or use `aerekos-network`)

### Phase 2: PostgreSQL Handler
- [ ] Create `api/services/databases/postgresql.js`
  - [ ] `getContainerConfig(config)` - Build Docker config for PostgreSQL
    - Image: `postgres:15-alpine`
    - Environment: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
    - Port mappings, volumes, resource limits
  - [ ] `waitForReady(container)` - Wait for PostgreSQL to be ready
    - Poll logs for "database system is ready"
    - Timeout after 60 seconds

### Phase 3: Update DatabaseService
- [ ] Add InstanceService dependency
- [ ] Update `createDatabase()`:
  - [ ] Accept username/password from config (use if provided, generate if not)
  - [ ] Call InstanceService.createInstance() to create container
  - [ ] Wait for container to be ready
  - [ ] Update status to 'running' on success, 'failed' on error
  - [ ] Store container_name, actual port, host in database record
- [ ] Add `startDatabase(name)` - Start container
- [ ] Add `stopDatabase(name)` - Stop container
- [ ] Add `restartDatabase(name)` - Restart container
- [ ] Update `deleteDatabase(name)` - Delete container and database record

### Phase 4: Update API Routes
- [ ] Update POST `/api/databases/:name/start` - Actually start container
- [ ] Update POST `/api/databases/:name/stop` - Actually stop container
- [ ] Add POST `/api/databases/:name/restart` - Restart container

### Phase 5: Tests
- [ ] Unit tests for InstanceService
- [ ] Unit tests for PostgreSQL handler
- [ ] Integration tests for container creation
- [ ] Test custom username/password/port
- [ ] Test start/stop/restart/delete

## 🔑 Key Integration Points

### key_manager Integration (Already Implemented ✅)
- EncryptionService already uses key_manager
- Connection strings and passwords encrypted before storage
- Encryption key auto-created if it doesn't exist
- **No changes needed** - just use EncryptionService as-is

### storage_manager Integration (Future)
- Backups will be stored in storage_manager buckets
- Use storage_manager API: `POST /api/services/storage_manager/api/projects/{projectId}/buckets/db-backups/files/{backupName}.sql.gz`
- Backups encrypted via storage_manager (which uses key_manager)
- **Not needed for initial implementation** - can add later

## 📝 Example API Usage

### Create PostgreSQL Database
```bash
POST /api/services/db_manager/api/databases
{
  "name": "my-app-db",
  "type": "postgresql",
  "username": "app_user",        # Optional - auto-generated if not provided
  "password": "secure_pass",     # Optional - auto-generated if not provided
  "port": 5433,                   # Optional - auto-assigned if not provided
  "resource_limits": {
    "cpu_cores": 2,
    "ram_gb": 4,
    "disk_gb": 50
  }
}
```

### Expected Response
```json
{
  "id": "uuid",
  "name": "my-app-db",
  "type": "postgresql",
  "status": "running",
  "port": 5433,
  "username": "app_user",
  "host": "localhost",
  "container_name": "aerekos-db-my-app-db",
  "created_at": "2024-01-01T00:00:00Z"
}
```

## 🎨 Container Configuration Pattern

Based on `worker/docker/ServiceManager.js:buildContainerConfig()`:

```javascript
const containerConfig = {
  Image: 'postgres:15-alpine',
  name: 'aerekos-db-my-app-db',
  Env: [
    'POSTGRES_USER=app_user',
    'POSTGRES_PASSWORD=secure_pass',
    'POSTGRES_DB=my-app-db'
  ],
  ExposedPorts: { '5432/tcp': {} },
  HostConfig: {
    PortBindings: {
      '5432/tcp': [{ HostPort: '5433' }]
    },
    Binds: [],  // Use volumes instead
    Memory: 4 * 1024 * 1024 * 1024,  // 4GB RAM
    NanoCPUs: 2 * 1e9,  // 2 CPU cores
    RestartPolicy: { Name: 'unless-stopped' }
  },
  Labels: {
    'aerekos.service': 'db_manager',
    'aerekos.database': 'my-app-db',
    'aerekos.managed': 'true'
  },
  NetworkingConfig: {
    EndpointsConfig: {
      'aerekos-network': {}
    }
  }
};

// Create volume first
const volume = await docker.createVolume({
  Name: 'aerekos-db-my-app-db-data'
});

// Then create container
const container = await docker.createContainer(containerConfig);
await container.start();
```

## ⚠️ Important Notes

1. **db_manager runs on worker** - Has direct Docker access via `/var/run/docker.sock`
2. **Use dockerode** - Same library as worker's ServiceManager
3. **Container naming**: `aerekos-db-{database-name}` (consistent with worker naming)
4. **Volume persistence**: Use Docker volumes, not bind mounts
5. **Network**: Connect to worker's network (detect or use `aerekos-network`)
6. **Error handling**: Handle Docker errors gracefully
7. **Status tracking**: Update database record status based on container state

## 🧪 Testing Strategy

1. **Unit Tests**:
   - Test InstanceService methods in isolation (mock dockerode)
   - Test PostgreSQL handler config generation
   - Test port finding logic

2. **Integration Tests**:
   - Test container creation end-to-end (requires Docker)
   - Test start/stop/restart/delete
   - Test custom credentials
   - Test port assignment

3. **Manual Testing**:
   - Create database via API
   - Verify container exists: `docker ps | grep aerekos-db-`
   - Connect to database using connection string
   - Test start/stop/restart
   - Test delete (verify container and volume removed)

## 📖 Reference Documentation

- **dockerode API**: https://github.com/apocas/dockerode
- **PostgreSQL Docker Image**: https://hub.docker.com/_/postgres
- **Worker ServiceManager**: `worker/docker/ServiceManager.js`
- **db_manager Plan**: `worker/db_manager/plan.md`
- **Implementation Guide**: `worker/db_manager/IMPLEMENTATION_PLAN.md`

## ✅ Success Criteria

When done, you should be able to:
1. ✅ Create PostgreSQL database with custom username/password/port via API
2. ✅ Verify container is actually created and running (`docker ps`)
3. ✅ Get connection string and connect to database
4. ✅ Start/stop/restart database containers
5. ✅ Delete database (container and volume removed)
6. ✅ Credentials encrypted in database record
7. ✅ Port management works (finds available ports)

---

**Start by reading the files listed above, then implement InstanceService and PostgreSQL handler!**

Good luck! 🚀

