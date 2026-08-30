# db_manager Implementation Prompt

## Context & Current Status

You are implementing the **Database Manager Service (db_manager)** for aerekos-cloud. This service allows users to spawn database containers (PostgreSQL, MongoDB, Neo4j, Elasticsearch, Redis) with customizable ports, usernames, passwords, and resource limits.

### Current Implementation Status

✅ **COMPLETE**:
- **DatabaseService** (`api/services/DatabaseService.js`) - Creates database records, encrypts credentials using key_manager
- **EncryptionService** (`api/services/EncryptionService.js`) - Encrypts connection strings/passwords using key_manager (REQUIRED)
- **DatabaseRepository** (`api/repos/DatabaseRepository.js`) - CRUD operations for database records
- **API Routes** (`api/routes/databases.js`) - Basic CRUD endpoints (POST, GET, DELETE, connection endpoint)
- **Database Models** (`api/models/index.js`) - DatabaseInstance, DatabaseBackup, DatabaseConnection models
- **Health Checks** - `/health` and `/ready` endpoints
- **Tests** - Unit and integration tests for existing functionality
- **Docker Setup** - docker-compose.yml, Dockerfile.dev configured

❌ **MISSING** (What you need to implement):
- **InstanceService** (`api/services/InstanceService.js`) - Actually creates Docker containers using dockerode
- **PostgreSQL Handler** (`api/services/databases/postgresql.js`) - PostgreSQL-specific container creation
- **Container Lifecycle** - Start/stop/restart/delete containers
- **Port Management** - Find available ports on worker
- **Custom Credentials** - Support custom username/password in API (schema updated, but not used yet)

### Architecture Overview

**db_manager runs on the worker** - It has direct access to Docker socket (`/var/run/docker.sock`) and can create containers directly using dockerode (same pattern as `worker/docker/ServiceManager.js`).

**Service Dependencies**:
- **key_manager** (REQUIRED) - Used for encrypting connection strings and passwords before storage
- **storage_manager** (Optional) - Used for storing database backups in buckets
- **Conductor** - Service registration, routing, authentication
- **Worker** - Docker container management (db_manager runs on worker)

### Key Files to Review

1. **Worker Container Creation Pattern**:
   - `worker/docker/ServiceManager.js` - See how worker creates containers using dockerode
   - `worker/docker/ServiceManager.js:buildContainerConfig()` - Container configuration pattern
   - `worker/docker/ServiceManager.js:startService()` - Container creation and startup pattern

2. **db_manager Current Implementation**:
   - `worker/db_manager/api/services/DatabaseService.js` - Current database service (creates records, doesn't create containers yet)
   - `worker/db_manager/api/services/EncryptionService.js` - Encryption service (already uses key_manager)
   - `worker/db_manager/api/routes/databases.js` - API routes (accepts username/password/port but doesn't use them yet)

3. **Integration Examples**:
   - `worker/storage_manager/api/services/EncryptionService.js` - See how storage_manager uses key_manager
   - `worker/storage_manager/api/services/BucketService.js` - See how storage_manager ensures encryption keys exist

4. **Plan Files**:
   - `worker/db_manager/plan.md` - Complete implementation plan
   - `worker/db_manager/IMPLEMENTATION_PLAN.md` - Detailed implementation guide
   - `plan.md` (root) - High-level project roadmap

## Your Task

Implement Docker container creation for db_manager, starting with PostgreSQL. Users should be able to:

1. **Create PostgreSQL databases** with:
   - Custom username (optional - auto-generated if not provided)
   - Custom password (optional - auto-generated if not provided)
   - Custom port (optional - auto-assigned if not provided)
   - Resource limits (CPU, RAM, disk)
   - Automatic encryption of credentials using key_manager

2. **Manage containers**:
   - Start/stop/restart containers
   - Delete containers (with volume cleanup)
   - Get container status

3. **Integration**:
   - Use key_manager for encryption (already implemented in EncryptionService)
   - Use storage_manager for backups (future enhancement)

## Implementation Steps

### Step 1: Create InstanceService

**File**: `worker/db_manager/api/services/InstanceService.js`

**Pattern**: Follow `worker/docker/ServiceManager.js` - use dockerode directly to create containers.

**Key Methods**:
```javascript
class InstanceService {
  constructor() {
    this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
  }
  
  async createInstance(config) {
    // config: { name, type, username, password, port, resource_limits, ... }
    // 1. Build container config (use database type handler)
    // 2. Create Docker volume for data persistence
    // 3. Create container using dockerode
    // 4. Start container
    // 5. Wait for database to be ready (use type handler)
    // 6. Return container info
  }
  
  async findAvailablePort(startPort) {
    // Query Docker for existing containers
    // Check which ports are in use
    // Return first available port >= startPort
  }
  
  async startInstance(containerName) { /* ... */ }
  async stopInstance(containerName) { /* ... */ }
  async restartInstance(containerName) { /* ... */ }
  async deleteInstance(containerName) { /* ... */ }
  async getInstanceStatus(containerName) { /* ... */ }
}
```

**Container Configuration** (similar to ServiceManager.buildContainerConfig):
- **Image**: `postgres:15-alpine` (for PostgreSQL)
- **Container Name**: `aerekos-db-{database-name}`
- **Volume Name**: `aerekos-db-{database-name}-data`
- **Environment Variables**: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- **Port Mappings**: `{ '5432/tcp': [{ HostPort: port.toString() }] }`
- **Volumes**: `{ '/var/lib/postgresql/data': { Type: 'volume', Name: volumeName } }`
- **Resource Limits**: `HostConfig.Memory`, `HostConfig.NanoCPUs`
- **Network**: Connect to worker's network (detect or use `aerekos-network`)
- **Labels**: `{ 'aerekos.service': 'db_manager', 'aerekos.database': name, 'aerekos.managed': 'true' }`

### Step 2: Create PostgreSQL Handler

**File**: `worker/db_manager/api/services/databases/postgresql.js`

**Key Methods**:
```javascript
class PostgreSQLHandler {
  getContainerConfig(config) {
    // Build Docker container config for PostgreSQL
    // Return config object for dockerode
  }
  
  async waitForReady(container) {
    // Poll container logs for "database system is ready"
    // Or use pg_isready health check
    // Timeout after 60 seconds
  }
}
```

**PostgreSQL-Specific Config**:
- Image: `postgres:15-alpine` (or configurable version)
- Environment: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- Default Port: 5432 (container), custom port (host)
- Data Volume: `/var/lib/postgresql/data`

### Step 3: Update DatabaseService

**File**: `worker/db_manager/api/services/DatabaseService.js`

**Changes**:
1. Add InstanceService dependency
2. Update `createDatabase()` to:
   - Accept `username` and `password` from config (use if provided, generate if not)
   - Call InstanceService.createInstance() to actually create container
   - Wait for container to be ready
   - Update status to 'running' on success, 'failed' on error
   - Store actual port, host, container_name in database record

3. Add methods:
   - `startDatabase(name)` - Start container via InstanceService
   - `stopDatabase(name)` - Stop container via InstanceService
   - `restartDatabase(name)` - Restart container via InstanceService
   - Update `deleteDatabase(name)` - Delete container and database record

### Step 4: Update API Routes

**File**: `worker/db_manager/api/routes/databases.js`

**Changes**:
1. Schema already updated to accept `username` and `password` - no changes needed
2. Update POST `/api/databases/:name/start` to actually start container
3. Update POST `/api/databases/:name/stop` to actually stop container
4. Add POST `/api/databases/:name/restart` to restart container

### Step 5: Port Management

**Implementation**: Query Docker for existing containers, check used ports, find available port.

**Example**:
```javascript
async findAvailablePort(startPort) {
  const containers = await this.docker.listContainers({ all: true });
  const usedPorts = new Set();
  
  containers.forEach(container => {
    if (container.Ports) {
      container.Ports.forEach(port => {
        if (port.PublicPort) {
          usedPorts.add(port.PublicPort);
        }
      });
    }
  });
  
  let port = startPort;
  while (usedPorts.has(port)) {
    port++;
  }
  
  return port;
}
```

## Testing

After implementation, test:
1. Create PostgreSQL database with custom username/password/port
2. Get connection string and verify it works
3. Start/stop/restart database
4. Delete database (verify container and volume are removed)
5. Verify credentials are encrypted in database record
6. Verify container is created with correct configuration

## Integration Points

### key_manager Integration (Already Implemented)
- EncryptionService already uses key_manager
- Connection strings and passwords are encrypted before storage
- Encryption key is auto-created if it doesn't exist

### storage_manager Integration (Future)
- Backups will be stored in storage_manager buckets
- Use storage_manager API to upload/download backups
- Backups will be encrypted via storage_manager (which uses key_manager)

## Important Notes

1. **db_manager runs on worker** - Has direct Docker access, doesn't need to call worker API
2. **Use dockerode** - Same pattern as `worker/docker/ServiceManager.js`
3. **Container naming**: `aerekos-db-{database-name}` (consistent with worker's naming)
4. **Volume persistence**: Use Docker volumes for data persistence
5. **Network**: Connect containers to worker's network
6. **Error handling**: Handle Docker errors gracefully (container not found, port in use, etc.)
7. **Status tracking**: Update database record status based on container state

## Files to Create/Modify

**Create**:
- `worker/db_manager/api/services/InstanceService.js`
- `worker/db_manager/api/services/databases/postgresql.js`
- `worker/db_manager/tests/unit/services/InstanceService.test.js`
- `worker/db_manager/tests/unit/services/databases/postgresql.test.js`
- `worker/db_manager/tests/integration/container.test.js`

**Modify**:
- `worker/db_manager/api/services/DatabaseService.js` - Integrate InstanceService
- `worker/db_manager/api/routes/databases.js` - Update start/stop endpoints, add restart

## Success Criteria

✅ Can create PostgreSQL database with custom username/password/port
✅ Container is actually created and running
✅ Connection string works and can connect to database
✅ Credentials are encrypted in database record
✅ Can start/stop/restart database containers
✅ Can delete database (container and volume removed)
✅ Port management works (finds available ports)
✅ Error handling works (port in use, container not found, etc.)

## Next Steps After PostgreSQL

1. MongoDB handler
2. Neo4j handler
3. Elasticsearch handler
4. Redis handler
5. Backup integration with storage_manager
6. Frontend UI (Phase 8)

---

**Start by reading**:
1. `worker/docker/ServiceManager.js` - Understand container creation pattern
2. `worker/db_manager/api/services/DatabaseService.js` - Current implementation
3. `worker/db_manager/api/services/EncryptionService.js` - Encryption integration
4. `worker/db_manager/plan.md` - Complete plan
5. `worker/db_manager/IMPLEMENTATION_PLAN.md` - Detailed guide

Then implement InstanceService and PostgreSQL handler!

