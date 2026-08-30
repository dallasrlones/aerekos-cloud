# db_manager Docker Container Implementation Plan

## Current Status

✅ **Complete**:
- DatabaseService - Creates database records, encrypts credentials
- EncryptionService - Encrypts connection strings/passwords using key_manager
- DatabaseRepository - CRUD operations for database records
- API Routes - Basic CRUD endpoints
- Health checks
- Tests

❌ **Missing**:
- **InstanceService** - Actually creates Docker containers
- **Database type handlers** (postgresql.js, etc.) - Database-specific container creation
- **Container lifecycle management** - Start/stop/restart containers
- **Port management** - Find available ports on workers
- **Custom credentials** - Allow custom username/password in API

## Implementation Plan

### Phase 1: InstanceService - Docker Container Creation

**File**: `api/services/InstanceService.js`

**Purpose**: Handle Docker container creation, management, and lifecycle for database instances.

**Key Methods**:
1. `createInstance(config)` - Create database container via Docker
   - Use dockerode to create container
   - Configure environment variables (POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB)
   - Set up port mappings
   - Configure volumes for data persistence
   - Set resource limits (CPU, RAM)
   - Start container and wait for readiness

2. `findAvailablePort(workerId, startPort)` - Find available port on worker
   - Check if port is in use
   - Try next port if occupied
   - Return available port

3. `selectWorker(requirements)` - Select worker based on resources
   - Query conductor for available workers
   - Filter by resource requirements (CPU, RAM, disk)
   - Return best worker ID

4. `startInstance(containerName)` - Start database container
5. `stopInstance(containerName)` - Stop database container
6. `restartInstance(containerName)` - Restart database container
7. `deleteInstance(containerName)` - Delete database container and volumes
8. `getInstanceStatus(containerName)` - Get container status (running/stopped/failed)

**Dependencies**:
- `dockerode` - Docker API client (already in package.json)
- Conductor API - For worker selection
- Database type handlers - For database-specific configuration

### Phase 2: PostgreSQL Database Handler

**File**: `api/services/databases/postgresql.js`

**Purpose**: PostgreSQL-specific container creation and management.

**Key Methods**:
1. `createInstance(config)` - Create PostgreSQL container
   ```javascript
   {
     name: 'my-db',
     username: 'custom_user',  // Optional, auto-generated if not provided
     password: 'custom_pass',  // Optional, auto-generated if not provided
     port: 5432,               // Optional, auto-assigned if not provided
     database: 'my-db',        // Database name
     worker_id: 'worker-123',  // Optional, auto-selected if not provided
     resource_limits: {
       cpu_cores: 2,
       ram_gb: 4,
       disk_gb: 20
     }
   }
   ```

2. `getContainerConfig(config)` - Build Docker container config
   - Image: `postgres:15-alpine` (or configurable version)
   - Environment variables:
     - `POSTGRES_USER` - Username
     - `POSTGRES_PASSWORD` - Password
     - `POSTGRES_DB` - Database name
     - `POSTGRES_INITDB_ARGS` - Optional init args
   - Port mappings: `{ '5432/tcp': [{ HostPort: '5432' }] }`
   - Volumes: `{ '/var/lib/postgresql/data': { Type: 'volume', Name: 'db-my-db-data' } }`
   - Resource limits:
     - `NanoCPUs`: CPU cores * 1e9
     - `MemoryBytes`: RAM GB * 1e9

3. `waitForReady(container)` - Wait for PostgreSQL to be ready
   - Poll container logs for "database system is ready"
   - Or use health check endpoint
   - Timeout after 60 seconds

4. `initializeDatabase(connection)` - Run initialization SQL (if needed)
5. `backupDatabase(connection, backupPath)` - Backup PostgreSQL (future)
6. `restoreDatabase(connection, backupPath)` - Restore PostgreSQL (future)

### Phase 3: Update DatabaseService

**File**: `api/services/DatabaseService.js`

**Changes**:
1. Add InstanceService dependency
2. Update `createDatabase()` to:
   - Call InstanceService.createInstance() to actually create container
   - Wait for container to be ready
   - Update status to 'running' on success
   - Update status to 'failed' on error
   - Store actual port, host, container name in database record

3. Add methods:
   - `startDatabase(name)` - Start container via InstanceService
   - `stopDatabase(name)` - Stop container via InstanceService
   - `restartDatabase(name)` - Restart container via InstanceService
   - `deleteDatabase(name)` - Delete container and database record

4. Support custom username/password:
   - Accept `username` and `password` in config
   - Use provided values or generate if not provided
   - Pass to InstanceService

### Phase 4: Update API Routes

**File**: `api/routes/databases.js`

**Changes**:
1. Update `createDatabaseSchema` to accept:
   ```javascript
   {
     name: string (required),
     type: string (required, enum: ['postgresql', ...]),
     username: string (optional),
     password: string (optional),
     port: number (optional),
     worker_id: string (optional),
     resource_limits: {
       cpu_cores: number (optional),
       ram_gb: number (optional),
       disk_gb: number (optional)
     },
     metadata: object (optional)
   }
   ```

2. Update POST `/api/databases` to:
   - Pass username/password to DatabaseService
   - Handle container creation errors
   - Return container status in response

3. Update POST `/api/databases/:name/start` to:
   - Actually start container via InstanceService
   - Update status in database

4. Update POST `/api/databases/:name/stop` to:
   - Actually stop container via InstanceService
   - Update status in database

5. Add POST `/api/databases/:name/restart`:
   - Restart container via InstanceService

### Phase 5: Port Management

**File**: `api/services/InstanceService.js`

**Implementation**:
```javascript
async findAvailablePort(workerId, startPort) {
  // Query conductor for worker info
  // Get list of existing database containers on that worker
  // Check which ports are in use
  // Find first available port starting from startPort
  // Return available port
}
```

**Alternative**: Use dockerode to check port availability directly:
```javascript
async findAvailablePort(startPort) {
  const docker = new Docker();
  const containers = await docker.listContainers({ all: true });
  
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

### Phase 6: Container Lifecycle Management

**Implementation**:
- Start: `docker start <container-name>`
- Stop: `docker stop <container-name>`
- Restart: `docker restart <container-name>`
- Delete: `docker rm -v <container-name>` (remove volumes too)

**Status Tracking**:
- Query Docker for container status
- Update database record status accordingly
- Handle container not found errors

## Example Usage

### Create PostgreSQL Database with Custom Settings

```bash
POST /api/services/db_manager/api/databases
{
  "name": "my-app-db",
  "type": "postgresql",
  "username": "app_user",
  "password": "secure_password_123",
  "port": 5433,
  "resource_limits": {
    "cpu_cores": 2,
    "ram_gb": 4,
    "disk_gb": 50
  },
  "metadata": {
    "description": "Database for my application"
  }
}
```

**Response**:
```json
{
  "id": "uuid",
  "name": "my-app-db",
  "type": "postgresql",
  "status": "running",
  "port": 5433,
  "username": "app_user",
  "host": "worker-123",
  "container_name": "aerekos-db-my-app-db",
  "created_at": "2024-01-01T00:00:00Z"
}
```

### Get Connection String

```bash
GET /api/services/db_manager/api/databases/my-app-db/connection
```

**Response**:
```json
{
  "connection_string": "postgresql://app_user:secure_password_123@worker-123:5433/my-app-db",
  "username": "app_user",
  "password": "secure_password_123",
  "host": "worker-123",
  "port": 5433,
  "database": "my-app-db"
}
```

## Implementation Order

1. ✅ **InstanceService.js** - Core Docker container management
2. ✅ **postgresql.js** - PostgreSQL-specific handler
3. ✅ **Update DatabaseService** - Integrate InstanceService
4. ✅ **Update API routes** - Add custom username/password support
5. ✅ **Port management** - Find available ports
6. ✅ **Container lifecycle** - Start/stop/restart/delete
7. ✅ **Tests** - Unit and integration tests

## Next Steps

1. Start with InstanceService.js - implement basic Docker container creation
2. Create postgresql.js handler - PostgreSQL-specific configuration
3. Update DatabaseService to use InstanceService
4. Test end-to-end: Create database → Get connection string → Connect to database
5. Add start/stop/restart functionality
6. Add port management
7. Add tests

