# Database Manager Service Implementation Plan

## ✅ STATUS: CORE FUNCTIONALITY COMPLETE - TDD Testing Phase

**Backend Status**: ✅ Core Complete, ⏳ TDD Testing In Progress
- ✅ Phases 1-4: Core implementation complete
- ✅ Phase 5: Health checks complete for all database types
- ✅ Phase 6: Unit tests for core services complete
- ✅ InstanceService: Docker container management implemented
- ✅ Database Handlers: PostgreSQL ✅, MongoDB ✅, Redis ✅, Neo4j ✅, Elasticsearch ✅
- ⏳ SQLite3 Handler: Pending implementation
- ✅ Project-scoped: All databases are project-scoped (project_id required)
- ✅ Encryption: All credentials encrypted via key_manager
- ⏳ Remaining: TDD tests for all database handlers, BackupService, metrics

**Docker Status**: ✅ Complete
- docker-compose.yml configured
- Dockerfile.dev created
- All services dockerized

**Priority**: HIGH - Foundation service for database management across the platform

## Quick Start for Agents

**CAN BE IMPLEMENTED IN PARALLEL WITH**: storage_manager

**Dependencies**:
- ✅ Conductor (must be running)
- ✅ Worker (for Docker container management)
- ✅ **key_manager** (REQUIRED - for encrypting connection strings, passwords, and sensitive metadata)
- ⚠️ storage_manager (optional - for backups, can store locally initially)

**Key Implementation Points**:
1. Database instance creation via Docker
2. Multi-database type support (PostgreSQL, MongoDB, etc.)
3. Connection string encryption using key_manager (REQUIRED)
4. Password encryption using key_manager (REQUIRED)
5. Backup integration with storage_manager (optional initially)

**CRITICAL**: This service REQUIRES key_manager to be running and accessible. Connection strings and passwords MUST be encrypted using keys from key_manager before storage. The service will fail to start if key_manager is not available.

**See "How Other Services Use db_manager" section below for integration examples.**

## Overview

Database Manager Service provides database instance management for aerekos-cloud. It creates, manages, and monitors database instances (PostgreSQL, MongoDB, Neo4j, Elasticsearch, Redis, SQLite3) across workers, handles connection pooling, and provides database lifecycle management.

**Follow**: [../../plan.md](../../plan.md) for high-level roadmap and architecture overview.

## Implementation Order

**This service can be implemented in parallel with storage_manager**. However, it REQUIRES key_manager for encryption of connection strings and passwords.

**Dependencies**:
- ✅ **key_manager**: REQUIRED - Must be running and accessible. Used for encrypting connection strings, passwords, and sensitive metadata.
- ⚠️ **storage_manager**: Can be implemented in parallel (needed for backup storage, but backups are optional)
- ✅ **Worker**: Must be available (for Docker container management)

## Architecture

### Key Features
- **Multi-Database Support**: PostgreSQL, MongoDB, Neo4j, Elasticsearch, Redis, SQLite3, SQLite3
- **Database Lifecycle**: Create, start, stop, delete databases
- **Connection Management**: Connection pooling and management
- **Backup Integration**: Integrates with storage_manager for backups
- **Resource Management**: Tracks database resource usage
- **High Availability**: Can deploy databases across multiple workers
- **Enterprise Features**: Health checks, metrics, monitoring

### Service Dependencies
- **Conductor**: Service registration, routing, authentication
- **storage_manager**: Database backup storage
- **Worker**: Docker container management for database instances

### Service Consumers
- **All services**: Database creation and management
- **key_manager**: Database for key storage
- **storage_manager**: Database for metadata
- **api_manager**: Database selection/creation for user APIs

## Phase 1: Initial Setup & Configuration

### 1.1 Project Structure
- [ ] Create folder structure:
  - `api/` - Express API server
  - `api/routes/` - API routes
  - `api/services/` - Business logic (DatabaseService, InstanceService)
  - `api/repos/` - Data access (DatabaseRepository, InstanceRepository)
  - `api/middleware/` - Express middleware
  - `api/utils/` - Utility functions (connection pooling, health checks)
  - `scripts/` - Utility scripts (entrypoint, database initialization)
  - `data/` - SQLite database for metadata (gitignored)
  - `tests/` - Test files

### 1.2 Environment Configuration
- [ ] Create `.env_example` with:
  - `PORT` - Service port (default: 3004, auto-detect if in use)
  - `CONDUCTOR_URL` - Conductor API URL
  - `SERVICE_NAME` - Service name (default: `db_manager`)
  - `SERVICE_VERSION` - Service version (e.g., `1.0.0`)
  - `STORAGE_MANAGER_URL` - storage_manager service URL (via conductor: `/api/services/storage_manager`)
  - `WORKER_URL` - Worker API URL (for Docker management)
  - `DEFAULT_DB_TYPE` - Default database type (default: `postgresql`)
  - `MAX_INSTANCES_PER_WORKER` - Max DB instances per worker (default: `10`)
  - `DEFAULT_DB_PORT_START` - Starting port for databases (default: `5432`)
  - `BACKUP_ENABLED` - Enable automatic backups (default: `true`)
  - `BACKUP_INTERVAL` - Backup interval in hours (default: `24`)
  - `LOG_LEVEL` - Logging level (default: `info`)
  - `NODE_ENV` - Environment (development/production)

### 1.3 Package Dependencies
- [ ] Create `package.json` with:
  - `express` - Web framework
  - `dotenv` - Environment variables
  - `axios` - HTTP client for conductor/storage_manager/worker calls
  - `dockerode` - Docker API client (for container management)
  - `pg` - PostgreSQL client
  - `mongodb` - MongoDB client
  - `neo4j-driver` - Neo4j driver
  - `@elastic/elasticsearch` - Elasticsearch client
  - `ioredis` - Redis client
  - `generic-pool` - Connection pooling
  - `joi` - Input validation
  - `winston` - Structured logging
  - `node-cron` - Scheduled tasks (backups)
  - `uuid` - UUID generation
  - **`aerekos-record`** - **REQUIRED**: ORM for all database models (must be installed)
  - `jest` - Testing framework
  - `supertest` - API testing

**Note**: aerekos-record is located at `../../services/aerekos-record` in the worker directory. You can either:
- Copy it to each service's `node_modules`, OR
- Use a symlink, OR
- Reference it directly: `const Record = require('../../services/aerekos-record')`

### 1.4 Docker Setup
- [x] Create `Dockerfile` (production) - Uses Dockerfile from worker root
- [x] Create `Dockerfile.dev` (development with nodemon)
- [x] Create `docker-compose.yml`:
  - [x] Mount data directory: `./data:/app/data`
  - [x] Mount Docker socket for container management
  - [x] Environment variables
  - [x] Health check: `GET /health`
  - [x] Network: Connect to aerekos-cloud-network
- [x] Create `nodemon.json` for development hot-reload

## Phase 2: Database Setup

### 2.1 Metadata Database (SQLite)
- [ ] Create SQLite database for metadata:
  - Database instances tracking
  - Connection details
  - Resource usage
  - Backup schedules

### 2.2 Database Models (using aerekos-record)

**CRITICAL**: All models MUST use aerekos-record. Never use raw SQL or other ORMs.

- [x] Create `api/models/index.js`:
  ```javascript
  const db = require('../utils/dbClient');
  
  // DatabaseInstance Model
  const DatabaseInstance = db.model('DatabaseInstance', {
    name: 'string',
    type: 'string',  // 'postgresql', 'mongodb', 'neo4j', 'elasticsearch', 'redis'
    worker_id: 'string',  // Worker hosting the database
    status: 'string',  // 'creating', 'running', 'stopped', 'failed'
    port: 'number',
    connection_string: 'string',  // Encrypted connection string (encrypted with key_manager)
    username: 'string',
    password_hash: 'string',  // Hashed password (never store plaintext)
    password_encrypted: 'string',  // Encrypted password (encrypted with key_manager)
    resource_limits: 'string',  // JSON string for CPU, RAM, disk limits
    metadata: 'string'  // JSON string for additional metadata
  }, {
    required: ['name', 'type', 'status'],
    unique: ['name'],
    timestamps: true
  });
  
  // DatabaseBackup Model
  const DatabaseBackup = db.model('DatabaseBackup', {
    database_instance_id: 'string',  // Foreign key to DatabaseInstance
    backup_type: 'string',  // 'full', 'incremental'
    storage_path: 'string',  // Path in storage_manager
    size_bytes: 'number',
    status: 'string',  // 'in_progress', 'completed', 'failed'
    metadata: 'string'  // JSON string for backup metadata
  }, {
    required: ['database_instance_id', 'backup_type', 'status'],
    belongsTo: ['DatabaseInstance'],  // Creates database_instance_id foreign key
    timestamps: true
  });
  
  // DatabaseConnection Model (connection pool tracking)
  const DatabaseConnection = db.model('DatabaseConnection', {
    database_instance_id: 'string',  // Foreign key to DatabaseInstance
    service_name: 'string',
    connection_count: 'number',
    max_connections: 'number',
    last_used: 'datetime'
  }, {
    required: ['database_instance_id', 'service_name'],
    belongsTo: ['DatabaseInstance'],
    timestamps: false  // We use last_used instead
  });
  
  module.exports = {
    DatabaseInstance,
    DatabaseBackup,
    DatabaseConnection,
    db
  };
  ```

**Model Usage Examples**:
```javascript
const { DatabaseInstance, DatabaseBackup, DatabaseConnection } = require('../models');

// Create a database instance
const dbInstance = await DatabaseInstance.create({
  name: 'my-app-db',
  type: 'postgresql',
  worker_id: 'worker-123',
  status: 'running',
  port: 5432,
  connection_string: 'postgresql://user:pass@host:5432/db',
  username: 'user',
  password_hash: 'hashed-password',
  resource_limits: JSON.stringify({ cpu_cores: 2, ram_gb: 4 }),
  metadata: JSON.stringify({ description: 'Database for my app' })
});

// Find database by name
const foundDb = await DatabaseInstance.findAll({ where: { name: 'my-app-db' } });

// Update database status
await DatabaseInstance.update(dbInstance.id, { status: 'stopped' });

// Create a backup record
const backup = await DatabaseBackup.create({
  database_instance_id: dbInstance.id,
  backup_type: 'full',
  storage_path: 'backups/my-app-db/backup-123.tar.gz',
  size_bytes: 1024000,
  status: 'completed',
  metadata: JSON.stringify({})
});

// Track connection usage
await DatabaseConnection.create({
  database_instance_id: dbInstance.id,
  service_name: 'api_manager',
  connection_count: 5,
  max_connections: 10,
  last_used: new Date().toISOString()
});
```

### 2.3 Database Initialization
- [x] Create `api/utils/dbClient.js` - SQLite database connection
- [x] Create `tests/unit/utils/dbClient.test.js` - Test database connection
- [ ] Create database initialization script
- [ ] Create tables/indexes on first startup
- [ ] Set up indexes for performance

### 2.4 Encryption Service (REQUIRED)
- [x] Create `api/services/EncryptionService.js`:
  - [x] `getEncryptionKey(keyName)` - Get encryption key from key_manager
  - [x] `encryptData(data, keyName)` - Encrypt connection strings/passwords
  - [x] `decryptData(encryptedData, keyName)` - Decrypt connection strings/passwords
  - [x] `ensureEncryptionKey(keyName)` - Create key if it doesn't exist
- [x] Create `tests/unit/services/EncryptionService.test.js`:
  - [x] Test mock key_manager mode
  - [x] Test real key_manager API calls
  - [x] Test encryption/decryption
  - [x] Test key creation

## Phase 3: Core Database Management

### 3.1 Database Service
- [x] Create `api/services/DatabaseService.js`:
  - [x] `createDatabase(name, type, config)` - Create database instance (with encryption)
  - [x] `getDatabase(name)` - Get database details
  - [x] `listDatabases(filter)` - List all databases
  - [x] `deleteDatabase(name)` - Delete database instance
  - [x] `getConnectionString(name)` - Get decrypted connection string
  - [x] `getPassword(name)` - Get decrypted password
  - [x] `updateStatus(name, status)` - Update database status
  - [x] `generateUsername(dbName)` - Generate secure username
  - [x] `generatePassword()` - Generate secure password
  - [x] `buildConnectionString(type, config)` - Build connection string
  - [x] `getDefaultPort(type)` - Get default port for database type
- [x] Create `tests/unit/services/DatabaseService.test.js`:
  - [x] Test createDatabase with encryption
  - [x] Test getDatabase
  - [x] Test getConnectionString (decryption)
  - [x] Test listDatabases with filters
  - [x] Test deleteDatabase

### 3.2 Instance Service
- [x] Create `api/services/InstanceService.js`:
  - **Uses dockerode directly** (like worker's ServiceManager) - db_manager runs on worker, has access to Docker socket
  - `createInstance(config)` - Create database container via dockerode
    - Use dockerode to create container (similar to worker/docker/ServiceManager.js)
    - Configure environment variables (POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB)
    - Set up port mappings (custom or auto-assigned)
    - Configure volumes for data persistence (Docker volumes)
    - Set resource limits (CPU, RAM) via HostConfig
    - Connect to worker's network (aerekos-network or detected network)
    - Start container and wait for readiness
  - `findAvailablePort(startPort)` - Find available port on current worker
    - Query Docker for existing containers
    - Check which ports are in use
    - Return first available port
  - `selectWorker(requirements)` - Select worker based on resources (optional - can use current worker)
    - Query conductor for available workers
    - Filter by resource requirements
    - Return best worker ID (or use current worker if running on worker)
  - `startInstance(containerName)` - Start database container
  - `stopInstance(containerName)` - Stop database container
  - `restartInstance(containerName)` - Restart database container
  - `deleteInstance(containerName)` - Delete container and volumes
  - `getInstanceStatus(containerName)` - Get container status (running/stopped/failed)
  
**Key Implementation Notes**:
- **db_manager runs on worker** - Has direct access to Docker socket (`/var/run/docker.sock`)
- **Use dockerode** - Same pattern as `worker/docker/ServiceManager.js`
- **Container naming**: `aerekos-db-{database-name}` (e.g., `aerekos-db-my-app-db`)
- **Volume naming**: `aerekos-db-{database-name}-data` (e.g., `aerekos-db-my-app-db-data`)
- **Network**: Connect to worker's network (detect or use `aerekos-network`)
- **Port management**: Find available ports by querying Docker for existing containers

### 3.3 Database Type Handlers
- [x] Create `api/services/databases/postgresql.js`:
  - `getContainerConfig(config)` - Build Docker container configuration
    - Image: `postgres:15-alpine` (or configurable version)
    - Environment variables:
      - `POSTGRES_USER` - Username (from config or auto-generated)
      - `POSTGRES_PASSWORD` - Password (from config or auto-generated)
      - `POSTGRES_DB` - Database name
      - `POSTGRES_INITDB_ARGS` - Optional init args
    - Port mappings: `{ '5432/tcp': [{ HostPort: port.toString() }] }`
    - Volumes: `{ '/var/lib/postgresql/data': { Type: 'volume', Name: 'aerekos-db-{name}-data' } }`
    - Resource limits:
      - `NanoCPUs`: CPU cores * 1e9 (if provided)
      - `MemoryBytes`: RAM GB * 1e9 (if provided)
    - Labels: `{ 'aerekos.service': 'db_manager', 'aerekos.database': name, 'aerekos.managed': 'true' }`
  - `createInstance(config)` - Create PostgreSQL container via InstanceService
    - Call InstanceService.createInstance() with PostgreSQL-specific config
    - Wait for PostgreSQL to be ready (poll logs or health check)
    - Return container info
  - `waitForReady(container)` - Wait for PostgreSQL to be ready
    - Poll container logs for "database system is ready to accept connections"
    - Or use health check: `pg_isready -h localhost -p 5432`
    - Timeout after 60 seconds
  - `initializeDatabase(connection)` - Run initialization SQL (if needed)
  - `backupDatabase(connection, backupPath)` - Backup PostgreSQL (future - integrates with storage_manager)
    - Use `pg_dump` to create backup
    - Upload to storage_manager bucket
  - `restoreDatabase(connection, backupPath)` - Restore PostgreSQL (future - integrates with storage_manager)
    - Download backup from storage_manager
    - Use `pg_restore` to restore database
- [ ] Create `api/services/databases/mongodb.js`:
  - `createInstance(config)` - Create MongoDB container
  - `initializeDatabase(connection)` - Initialize database
  - `backupDatabase(connection, backupPath)` - Backup MongoDB
  - `restoreDatabase(connection, backupPath)` - Restore MongoDB
- [ ] Create `api/services/databases/neo4j.js`:
  - `createInstance(config)` - Create Neo4j container
  - `initializeDatabase(connection)` - Initialize database
  - `backupDatabase(connection, backupPath)` - Backup Neo4j
  - `restoreDatabase(connection, backupPath)` - Restore Neo4j
- [ ] Create `api/services/databases/elasticsearch.js`:
  - `createInstance(config)` - Create Elasticsearch container
  - `initializeDatabase(connection)` - Initialize database
  - `backupDatabase(connection, backupPath)` - Backup Elasticsearch
  - `restoreDatabase(connection, backupPath)` - Restore Elasticsearch
- [ ] Create `api/services/databases/redis.js`:
  - `createInstance(config)` - Create Redis container
  - `initializeDatabase(connection)` - Initialize database
  - `backupDatabase(connection, backupPath)` - Backup Redis
  - `restoreDatabase(connection, backupPath)` - Restore Redis
- [ ] Create `api/services/databases/sqlite3.js`:
  - `getFileConfig(config)` - Build file-based config (SQLite3 is file-based, not containerized)
    - Database file path: `/app/data/databases/{projectName}/{databaseName}.db`
    - Create directory structure if needed
    - Set file permissions (read/write for owner)
    - Return file path and connection info
  - `createInstance(config)` - Create SQLite database file
    - Create directory structure: `/app/data/databases/{projectName}/`
    - Create database file using aerekos-record
    - Verify file exists and is readable
    - Return connection info (file path, type: 'sqlite')
  - `checkHealth(dbInstance, password)` - Check database file exists and is readable
    - Check file exists using `fs.accessSync()`
    - Attempt to connect using aerekos-record
    - Run simple query: `SELECT 1`
    - Return healthy if successful, unhealthy if file missing or corrupted
  - `backupDatabase(connection, backupPath)` - Copy database file to backup location
    - Use `fs.copyFileSync()` to copy database file
    - Upload to storage_manager if available
  - `restoreDatabase(connection, backupPath)` - Restore database file from backup
    - Download from storage_manager if needed
    - Replace database file using `fs.copyFileSync()`
    - Verify restored file is readable

### 3.4 Encryption Service

**CRITICAL**: This service REQUIRES key_manager for encrypting connection strings, passwords, and sensitive metadata. All sensitive data MUST be encrypted before storage.

- [ ] Create `api/services/EncryptionService.js`:
  ```javascript
  const axios = require('axios');
  const crypto = require('crypto');
  const logger = require('../utils/logger');
  
  class EncryptionService {
    constructor(conductorUrl, serviceToken) {
      this.conductorUrl = conductorUrl;
      this.serviceToken = serviceToken;
      this.defaultKeyName = 'db-manager-encryption-key';
    }
    
    /**
     * Get encryption key from key_manager via conductor
     * @param {string} keyName - Key name (e.g., 'db-manager-encryption-key')
     * @returns {Promise<object>} Key object with decrypted key material
     */
    async getEncryptionKey(keyName = this.defaultKeyName) {
      if (process.env.MOCK_KEY_MANAGER === 'true' || !process.env.CONDUCTOR_URL) {
        logger.warn(`[db_manager] Using mock key_manager for key '${keyName}' (development only)`);
        return {
          key_material: 'dev-mock-key-material-change-when-key-manager-ready-32bytes!!',
          key_version: 1,
          algorithm: 'AES-256-GCM'
        };
      }
      
      try {
        const response = await axios.get(
          `${this.conductorUrl}/api/services/key_manager/api/keys/${keyName}`,
          {
            headers: {
              'Authorization': `Bearer ${this.serviceToken}`,
              'Content-Type': 'application/json'
            },
            timeout: 5000
          }
        );
        return response.data;
      } catch (error) {
        if (error.response?.status === 404) {
          throw new Error(`Encryption key '${keyName}' not found in key_manager. Create it first.`);
        }
        throw new Error(`Failed to get encryption key: ${error.message}`);
      }
    }
    
    /**
     * Encrypt connection string or password using key_manager
     * @param {string} data - Data to encrypt
     * @param {string} keyName - Key name from key_manager
     * @returns {Promise<string>} Encrypted data (hex string with IV:authTag:encrypted)
     */
    async encryptData(data, keyName = this.defaultKeyName) {
      const key = await this.getEncryptionKey(keyName);
      
      // Convert key material to Buffer
      let keyBuffer;
      if (key.key_material.length === 64) {
        keyBuffer = Buffer.from(key.key_material, 'hex');
      } else {
        keyBuffer = Buffer.from(key.key_material.substring(0, 32).padEnd(32, '0'));
      }
      
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
      
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();
      
      // Return IV:authTag:encrypted (all hex)
      return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    }
    
    /**
     * Decrypt connection string or password using key_manager
     * @param {string} encryptedData - Encrypted data (IV:authTag:encrypted)
     * @param {string} keyName - Key name from key_manager
     * @returns {Promise<string>} Decrypted data
     */
    async decryptData(encryptedData, keyName = this.defaultKeyName) {
      const key = await this.getEncryptionKey(keyName);
      
      const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      
      // Convert key material to Buffer
      let keyBuffer;
      if (key.key_material.length === 64) {
        keyBuffer = Buffer.from(key.key_material, 'hex');
      } else {
        keyBuffer = Buffer.from(key.key_material.substring(0, 32).padEnd(32, '0'));
      }
      
      const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    }
    
    /**
     * Ensure encryption key exists in key_manager (create if needed)
     * @param {string} keyName - Key name
     * @returns {Promise<void>}
     */
    async ensureEncryptionKey(keyName = this.defaultKeyName) {
      try {
        await this.getEncryptionKey(keyName);
        logger.info(`[db_manager] Encryption key '${keyName}' exists`);
      } catch (error) {
        if (error.message.includes('not found')) {
          logger.info(`[db_manager] Creating encryption key '${keyName}'...`);
          try {
            await axios.post(
              `${this.conductorUrl}/api/services/key_manager/api/keys`,
              {
                name: keyName,
                type: 'symmetric',
                algorithm: 'AES-256-GCM',
                metadata: {
                  description: 'Encryption key for db_manager connection strings and passwords',
                  service: 'db_manager'
                }
              },
              {
                headers: {
                  'Authorization': `Bearer ${this.serviceToken}`,
                  'Content-Type': 'application/json'
                }
              }
            );
            logger.info(`[db_manager] Encryption key '${keyName}' created`);
          } catch (createError) {
            throw new Error(`Failed to create encryption key: ${createError.message}`);
          }
        } else {
          throw error;
        }
      }
    }
  }
  
  module.exports = EncryptionService;
  ```

**Usage in DatabaseService**:
```javascript
const EncryptionService = require('./EncryptionService');

class DatabaseService {
  constructor() {
    this.encryptionService = new EncryptionService(
      process.env.CONDUCTOR_URL,
      process.env.SERVICE_TOKEN
    );
  }
  
  async createDatabase(name, type, config) {
    // Generate credentials
    const username = this.generateUsername();
    const password = this.generatePassword();
    
    // Encrypt connection string and password before storage
    const connectionString = `postgresql://${username}:${password}@host:5432/${name}`;
    const encryptedConnectionString = await this.encryptionService.encryptData(connectionString);
    const encryptedPassword = await this.encryptionService.encryptData(password);
    
    // Store encrypted data
    const dbInstance = await DatabaseInstance.create({
      name,
      type,
      connection_string: encryptedConnectionString,
      password_hash: await this.hashPassword(password), // Also hash for verification
      // ... other fields
    });
    
    return dbInstance;
  }
  
  async getConnectionString(databaseName) {
    const dbInstance = await this.getDatabase(databaseName);
    
    // Decrypt connection string before returning
    const decryptedConnectionString = await this.encryptionService.decryptData(
      dbInstance.connection_string
    );
    
    return decryptedConnectionString;
  }
}
```

### 3.5 Backup Service

**IMPORTANT**: Backup functionality integrates with storage_manager. Backups are stored in storage_manager buckets.

**Integration with storage_manager**:
- Create backup bucket: `db-backups` (or project-specific bucket)
- Upload backups to storage_manager: `POST /api/services/storage_manager/api/projects/{projectId}/buckets/db-backups/files/{backupName}.sql.gz`
- Download backups from storage_manager: `GET /api/services/storage_manager/api/projects/{projectId}/buckets/db-backups/files/{backupName}.sql.gz`
- Use encryption keys from key_manager for backup encryption (via storage_manager)

**If storage_manager is not yet implemented**: Backups can be stored locally initially, then migrated to storage_manager later.

- [ ] Create `api/services/BackupService.js`:
  ```javascript
  const axios = require('axios');
  const fs = require('fs');
  const path = require('path');
  const { promisify } = require('util');
  const exec = promisify(require('child_process').exec);
  
  class BackupService {
    constructor(conductorUrl, serviceToken, storageManagerUrl) {
      this.conductorUrl = conductorUrl;
      this.serviceToken = serviceToken;
      this.storageManagerUrl = storageManagerUrl || `${conductorUrl}/api/services/storage_manager`;
    }
    
    /**
     * Create backup of a database
     * @param {string} databaseName - Database instance name
     * @param {string} backupType - 'full' or 'incremental'
     * @returns {Promise<object>} Backup record
     */
    async createBackup(databaseName, backupType = 'full') {
      const database = await this.getDatabase(databaseName);
      const backupId = require('uuid').v4();
      const backupPath = path.join('/tmp', `backup-${databaseName}-${backupId}.tar.gz`);
      
      try {
        // Create backup based on database type
        await this.backupDatabase(database, backupPath);
        
        // Upload to storage_manager if available
        let storagePath = null;
        try {
          storagePath = await this.uploadBackupToStorage(backupPath, databaseName, backupId);
        } catch (error) {
          console.warn(`[db_manager] Storage upload failed, keeping local backup: ${error.message}`);
          // Keep backup locally if storage_manager unavailable
        }
        
        // Create backup record
        const backupRecord = await this.createBackupRecord({
          database_instance_id: database.id,
          backup_type: backupType,
          storage_path: storagePath || backupPath,
          size_bytes: fs.statSync(backupPath).size,
          status: 'completed'
        });
        
        // Clean up local file if uploaded to storage
        if (storagePath) {
          fs.unlinkSync(backupPath);
        }
        
        return backupRecord;
      } catch (error) {
        // Clean up on error
        if (fs.existsSync(backupPath)) {
          fs.unlinkSync(backupPath);
        }
        throw error;
      }
    }
    
    /**
     * Upload backup to storage_manager via conductor
     * @param {string} backupPath - Local backup file path
     * @param {string} databaseName - Database name
     * @param {string} backupId - Backup ID
     * @returns {Promise<string>} Storage path in storage_manager
     */
    async uploadBackupToStorage(backupPath, databaseName, backupId) {
      try {
        // Ensure backup bucket exists
        await this.ensureBackupBucket();
        
        // Upload file to storage_manager
        const FormData = require('form-data');
        const form = new FormData();
        form.append('file', fs.createReadStream(backupPath));
        
        const response = await axios.put(
          `${this.storageManagerUrl}/backups/${databaseName}/${backupId}.tar.gz`,
          form,
          {
            headers: {
              ...form.getHeaders(),
              'Authorization': `Bearer ${this.serviceToken}`
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            timeout: 300000  // 5 minutes for large backups
          }
        );
        
        return `backups/${databaseName}/${backupId}.tar.gz`;
      } catch (error) {
        if (error.response?.status === 404) {
          throw new Error('storage_manager service not available');
        }
        throw new Error(`Failed to upload backup to storage: ${error.message}`);
      }
    }
    
    /**
     * Download backup from storage_manager
     * @param {string} backupId - Backup ID
     * @returns {Promise<string>} Local file path
     */
    async downloadBackupFromStorage(backupId) {
      const backup = await this.getBackup(backupId);
      const localPath = path.join('/tmp', `restore-${backupId}.tar.gz`);
      
      try {
        const response = await axios.get(
          `${this.storageManagerUrl}/${backup.storage_path}`,
          {
            headers: {
              'Authorization': `Bearer ${this.serviceToken}`
            },
            responseType: 'stream',
            timeout: 300000
          }
        );
        
        const writer = fs.createWriteStream(localPath);
        response.data.pipe(writer);
        
        return new Promise((resolve, reject) => {
          writer.on('finish', () => resolve(localPath));
          writer.on('error', reject);
        });
      } catch (error) {
        throw new Error(`Failed to download backup from storage: ${error.message}`);
      }
    }
    
    /**
     * Ensure backup bucket exists in storage_manager
     */
    async ensureBackupBucket() {
      try {
        await axios.put(
          `${this.storageManagerUrl}/backups`,
          {
            encryption_enabled: true,
            encryption_key_name: 'storage-encryption-key'
          },
          {
            headers: {
              'Authorization': `Bearer ${this.serviceToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
      } catch (error) {
        if (error.response?.status !== 409) {  // 409 = bucket already exists
          throw error;
        }
      }
    }
  }
  
  module.exports = BackupService;
  ```

**How to Use storage_manager**:
1. **Create Backup Bucket**: Call `PUT /api/services/storage_manager/backups` to ensure bucket exists
2. **Upload Backup**: Call `PUT /api/services/storage_manager/backups/{databaseName}/{backupId}.tar.gz` with file stream
3. **Download Backup**: Call `GET /api/services/storage_manager/{storagePath}` to download backup file
4. **Error Handling**: If storage_manager is unavailable, store backups locally and log warning

**Example Usage**:
```javascript
const BackupService = require('./BackupService');

const backupService = new BackupService(
  process.env.CONDUCTOR_URL,
  process.env.SERVICE_TOKEN,
  `${process.env.CONDUCTOR_URL}/api/services/storage_manager`
);

// Create backup (automatically uploads to storage_manager if available)
const backup = await backupService.createBackup('my-database', 'full');

// Restore from backup (downloads from storage_manager if needed)
const restored = await backupService.restoreBackup('my-database', backup.id);
```

### 3.6 Connection Pool Manager
- [ ] Create `api/services/ConnectionPoolService.js`:
  - `getPool(databaseName)` - Get or create connection pool
  - `acquireConnection(databaseName)` - Acquire connection from pool
  - `releaseConnection(databaseName, connection)` - Release connection
  - `closePool(databaseName)` - Close connection pool
  - `getPoolStats(databaseName)` - Get pool statistics

### 3.7 Repository Layer
- [x] Create `api/repos/DatabaseRepository.js`:
  - [x] `create(databaseData)` - Create database record
  - [x] `findByName(name)` - Find database by name
  - [x] `findById(id)` - Find database by ID
  - [x] `findAll(filter)` - List databases
  - [x] `update(id, databaseData)` - Update database
  - [x] `delete(id)` - Delete database
  - [x] `findByWorker(workerId)` - Find databases on worker
  - [x] `findByType(type)` - Find databases by type
  - [x] `findByStatus(status)` - Find databases by status
- [x] Create `tests/unit/repos/DatabaseRepository.test.js`:
  - [x] Test CRUD operations
  - [x] Test filtering methods

## Phase 4: API Endpoints

### 4.1 Database Management Routes
- [x] Create `api/routes/databases.js`:
  - [x] `POST /api/databases` - Create database (with encryption)
  - [x] `GET /api/databases` - List all databases (with filtering)
  - [x] `GET /api/databases/:name` - Get database details
  - [x] `DELETE /api/databases/:name` - Delete database
  - [x] `POST /api/databases/:name/start` - Start database
  - [x] `POST /api/databases/:name/stop` - Stop database
  - [x] `GET /api/databases/:name/connection` - Get decrypted connection string
- [x] Create `tests/integration/api.test.js`:
  - [x] Test POST /api/databases (create with encryption)
  - [x] Test GET /api/databases (list with filters)
  - [x] Test GET /api/databases/:name (get details)
  - [x] Test GET /api/databases/:name/connection (decrypt connection string)
  - [x] Test DELETE /api/databases/:name
  - [x] Test error handling (404, 400, 409)
- [ ] `POST /api/databases/:name/restart` - Restart database
- [ ] `GET /api/databases/:name/stats` - Get database statistics
- [ ] `POST /api/databases/:name/test` - Test database connection

### 4.2 Backup Routes (Future Enhancement)
- [ ] Create `api/routes/backups.js`:
  - `POST /api/databases/:name/backups` - Create backup
  - `GET /api/databases/:name/backups` - List backups
  - `POST /api/databases/:name/backups/:backupId/restore` - Restore backup
  - `DELETE /api/databases/:name/backups/:backupId` - Delete backup
  - `POST /api/databases/:name/backups/schedule` - Schedule automatic backups

### 4.3 Service Registration
- [x] Create `api/utils/serviceRegistration.js` - Register with conductor
- [x] Create `api/utils/portDetection.js` - Auto-detect available port
- [x] Auto-register with conductor on startup
- [x] Ensure encryption key exists after registration

### 4.4 Main Application File (index.js)
- [x] Create `index.js`:
  ```javascript
  require('dotenv').config();
  const express = require('express');
  const cors = require('cors');
  const { registerWithConductor } = require('./api/utils/serviceRegistration');
  const databaseRoutes = require('./api/routes/databases');
  const backupRoutes = require('./api/routes/backups');
  const errorHandler = require('./api/middleware/errorHandler');
  const validateServiceToken = require('./api/middleware/auth');
  
  const app = express();
  const PORT = process.env.PORT || 3004;
  
  // Middleware
  app.use(cors());
  app.use(express.json());
  
  // Health checks
  app.get('/health', async (req, res) => {
    try {
      const db = require('./api/utils/dbClient');
      await db.query('SELECT 1');
      res.status(200).json({ status: 'healthy', service: process.env.SERVICE_NAME });
    } catch (error) {
      res.status(503).json({ status: 'unhealthy', error: error.message });
    }
  });
  
  app.get('/ready', async (req, res) => {
    try {
      const db = require('./api/utils/dbClient');
      await db.query('SELECT 1');
      
      // Check Docker/worker connectivity
      const docker = require('dockerode')();
      await docker.ping();
      
      // Check key_manager is accessible (REQUIRED unless mocked)
      if (process.env.MOCK_KEY_MANAGER !== 'true' && process.env.CONDUCTOR_URL) {
        const axios = require('axios');
        try {
          const response = await axios.get(
            `${process.env.CONDUCTOR_URL}/api/services/key_manager/health`,
            { timeout: 3000 }
          );
          if (response.data.status !== 'healthy') {
            throw new Error('key_manager is not healthy');
          }
        } catch (error) {
          return res.status(503).json({
            status: 'not ready',
            error: 'key_manager is required but not accessible. Set MOCK_KEY_MANAGER=true for development only.'
          });
        }
      }
      
      res.status(200).json({ status: 'ready' });
    } catch (error) {
      res.status(503).json({ status: 'not ready', error: error.message });
    }
  });
  
  // API routes
  app.use('/api', validateServiceToken);
  app.use('/api/databases', databaseRoutes);
  app.use('/api/databases', backupRoutes);
  
  // Error handling
  app.use(errorHandler);
  
  // Start server
  async function startService() {
    try {
      // Check key_manager is available (REQUIRED unless mocked)
      if (process.env.MOCK_KEY_MANAGER !== 'true' && process.env.CONDUCTOR_URL) {
        const axios = require('axios');
        try {
          console.log('[db_manager] Checking key_manager availability...');
          const response = await axios.get(
            `${process.env.CONDUCTOR_URL}/api/services/key_manager/health`,
            { timeout: 5000 }
          );
          if (response.data.status !== 'healthy') {
            throw new Error('key_manager is not healthy');
          }
          console.log('[db_manager] key_manager is available and healthy');
          
          // Ensure encryption key exists
          const EncryptionService = require('./api/services/EncryptionService');
          const encryptionService = new EncryptionService(
            process.env.CONDUCTOR_URL,
            process.env.SERVICE_TOKEN
          );
          await encryptionService.ensureEncryptionKey();
        } catch (error) {
          console.error('[db_manager] ERROR: key_manager is REQUIRED but not accessible');
          console.error('[db_manager] Set MOCK_KEY_MANAGER=true for development only');
          console.error(`[db_manager] key_manager health check failed: ${error.message}`);
          process.exit(1);
        }
      } else if (process.env.MOCK_KEY_MANAGER === 'true') {
        console.warn('[db_manager] WARNING: Running with MOCK_KEY_MANAGER=true (development mode only)');
      }
      
      await registerWithConductor();
      app.listen(PORT, () => {
        console.log(`[db_manager] Server running on port ${PORT}`);
      });
    } catch (error) {
      console.error('[db_manager] Failed to start:', error);
      process.exit(1);
    }
  }
  
  startService();
  ```

## Phase 5: Health Checks & Monitoring

### 5.1 Health Check Endpoints
- [x] `GET /health` - Liveness probe:
  - [x] Check service is running
  - [x] Check metadata database connectivity
  - [x] Return 200 if healthy, 503 if unhealthy
- [x] `GET /ready` - Readiness probe:
  - [x] Check metadata database is ready
  - [x] Check key_manager is accessible (REQUIRED)
  - [x] Return 200 if ready, 503 if not ready

### 5.2 Metrics Endpoint
- [ ] `GET /metrics` - Prometheus-style metrics:
  - Database instance count (by type)
  - Active connections
  - Backup count (total, successful, failed)
  - Resource usage
  - Request counts
  - Error rates

## Phase 6: Testing (TDD Approach)

### 6.1 Unit Tests
- [x] Test EncryptionService methods (`tests/unit/services/EncryptionService.test.js`)
- [x] Test DatabaseService methods (`tests/unit/services/DatabaseService.test.js`)
- [x] Test DatabaseRepository methods (`tests/unit/repos/DatabaseRepository.test.js`)
- [x] Test Database models (`tests/unit/models/DatabaseInstance.test.js`)
- [x] Test dbClient (`tests/unit/utils/dbClient.test.js`)
- [ ] Test InstanceService methods (`tests/unit/services/InstanceService.test.js`)
- [ ] Test BackupService methods (`tests/unit/services/BackupService.test.js`)
- [ ] Test database type handlers (see 6.2 below)
- [ ] Test connection pool management (when implemented)

### 6.2 Database Type Handler Tests (TDD)

**Approach**: Write tests first, then implement handlers to pass tests. Start with PostgreSQL (baseline), then add SQLite3, then complete others.

#### 6.2.1 PostgreSQL Handler Tests (`tests/unit/services/databases/postgresql.test.js`)
- [ ] **Container Configuration Tests**:
  - [ ] `getContainerConfig()` returns correct Docker config with postgres:15-alpine image
  - [ ] `getContainerConfig()` sets POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB env vars
  - [ ] `getContainerConfig()` maps port correctly (default 5432 or custom)
  - [ ] `getContainerConfig()` creates volume mount for data persistence
  - [ ] `getContainerConfig()` sets resource limits (CPU, RAM) when provided
  - [ ] `getContainerConfig()` adds correct labels (aerekos.service, aerekos.database, aerekos.managed)
- [ ] **Container Creation Tests**:
  - [ ] `createInstance()` creates Docker container via InstanceService
  - [ ] `createInstance()` waits for PostgreSQL readiness
  - [ ] `createInstance()` returns container info with correct port/host
  - [ ] `createInstance()` handles Docker errors gracefully
- [ ] **aerekos-record Connectivity Tests**:
  - [ ] Can connect to PostgreSQL database using aerekos-record after creation
  - [ ] Connection string format is correct for aerekos-record PostgreSQL adapter
  - [ ] Can create tables using aerekos-record models
  - [ ] Can insert data using aerekos-record
  - [ ] Can query data using aerekos-record
  - [ ] Can update data using aerekos-record
  - [ ] Can delete data using aerekos-record
- [ ] **Health Check Tests**:
  - [ ] `checkHealth()` returns healthy when PostgreSQL is running
  - [ ] `checkHealth()` returns healthy when can connect via aerekos-record
  - [ ] `checkHealth()` returns unhealthy when PostgreSQL is stopped
  - [ ] `checkHealth()` uses pg_isready correctly
  - [ ] `checkHealth()` handles connection errors
- [ ] **Backup/Restore Tests** (when BackupService implemented):
  - [ ] `backupDatabase()` creates pg_dump backup
  - [ ] `backupDatabase()` uploads to storage_manager
  - [ ] `restoreDatabase()` downloads from storage_manager
  - [ ] `restoreDatabase()` restores using pg_restore
  - [ ] Restored database is accessible via aerekos-record

#### 6.2.2 SQLite3 Handler Tests (`tests/unit/services/databases/sqlite3.test.js`)
- [ ] **File Configuration Tests**:
  - [ ] `getFileConfig()` returns correct file path structure (`/app/data/databases/{projectName}/{databaseName}.db`)
  - [ ] `getFileConfig()` handles project name correctly
  - [ ] `getFileConfig()` handles database name sanitization
  - [ ] `getFileConfig()` returns connection info with type 'sqlite'
- [ ] **Database Creation Tests**:
  - [ ] `createInstance()` creates SQLite database file
  - [ ] `createInstance()` creates directory structure if it doesn't exist
  - [ ] `createInstance()` sets correct file permissions (read/write for owner)
  - [ ] `createInstance()` returns connection info (file path, type: 'sqlite')
  - [ ] `createInstance()` creates valid SQLite database file (can be opened)
  - [ ] `createInstance()` handles existing file gracefully (throws error or overwrites based on config)
- [ ] **aerekos-record Connectivity Tests**:
  - [ ] Can connect to SQLite database using aerekos-record after creation
  - [ ] Can create tables using aerekos-record models
  - [ ] Can insert data using aerekos-record
  - [ ] Can query data using aerekos-record
  - [ ] Can update data using aerekos-record
  - [ ] Can delete data using aerekos-record
  - [ ] Connection string format is correct for aerekos-record
- [ ] **Health Check Tests**:
  - [ ] `checkHealth()` returns healthy when database file exists and is readable
  - [ ] `checkHealth()` returns healthy when can connect via aerekos-record
  - [ ] `checkHealth()` returns healthy when can run `SELECT 1` query
  - [ ] `checkHealth()` returns unhealthy when database file doesn't exist
  - [ ] `checkHealth()` returns unhealthy when database file is corrupted
  - [ ] `checkHealth()` returns unhealthy when cannot connect via aerekos-record
  - [ ] `checkHealth()` handles permission errors
- [ ] **Backup/Restore Tests**:
  - [ ] `backupDatabase()` copies database file to backup location
  - [ ] `backupDatabase()` preserves file permissions
  - [ ] `backupDatabase()` uploads to storage_manager
  - [ ] `restoreDatabase()` downloads from storage_manager
  - [ ] `restoreDatabase()` replaces database file correctly
  - [ ] `restoreDatabase()` restored database is readable via aerekos-record

#### 6.2.3 MongoDB Handler Tests (`tests/unit/services/databases/mongodb.test.js`)
- [ ] **Container Configuration Tests**:
  - [ ] `getContainerConfig()` returns correct Docker config with mongo:7 image
  - [ ] `getContainerConfig()` sets MONGO_INITDB_ROOT_USERNAME, MONGO_INITDB_ROOT_PASSWORD
  - [ ] `getContainerConfig()` maps port correctly (default 27017)
  - [ ] `getContainerConfig()` creates volume mount for data persistence
- [ ] **Container Creation Tests**:
  - [ ] `createInstance()` creates Docker container via InstanceService
  - [ ] `createInstance()` waits for MongoDB readiness
  - [ ] `createInstance()` returns container info with correct port/host
- [ ] **Health Check Tests**:
  - [ ] `checkHealth()` returns healthy when MongoDB is running (mongosh ping)
  - [ ] `checkHealth()` returns unhealthy when MongoDB is stopped
  - [ ] `checkHealth()` handles authentication errors
- [ ] **Backup/Restore Tests**:
  - [ ] `backupDatabase()` creates mongodump backup
  - [ ] `backupDatabase()` uploads to storage_manager
  - [ ] `restoreDatabase()` downloads from storage_manager
  - [ ] `restoreDatabase()` restores using mongorestore

#### 6.2.4 Redis Handler Tests (`tests/unit/services/databases/redis.test.js`)
- [ ] **Container Configuration Tests**:
  - [ ] `getContainerConfig()` returns correct Docker config with redis:7-alpine image
  - [ ] `getContainerConfig()` sets REDIS_PASSWORD if provided
  - [ ] `getContainerConfig()` maps port correctly (default 6379)
  - [ ] `getContainerConfig()` creates volume mount for data persistence
- [ ] **Container Creation Tests**:
  - [ ] `createInstance()` creates Docker container via InstanceService
  - [ ] `createInstance()` waits for Redis readiness
  - [ ] `createInstance()` returns container info with correct port/host
- [ ] **Health Check Tests**:
  - [ ] `checkHealth()` returns healthy when Redis is running (redis-cli PING)
  - [ ] `checkHealth()` returns unhealthy when Redis is stopped
  - [ ] `checkHealth()` handles password authentication
- [ ] **Backup/Restore Tests**:
  - [ ] `backupDatabase()` creates RDB snapshot backup
  - [ ] `backupDatabase()` uploads to storage_manager
  - [ ] `restoreDatabase()` downloads from storage_manager
  - [ ] `restoreDatabase()` restores using RDB file

#### 6.2.5 Neo4j Handler Tests (`tests/unit/services/databases/neo4j.test.js`)
- [ ] **Container Configuration Tests**:
  - [ ] `getContainerConfig()` returns correct Docker config with neo4j:5 image
  - [ ] `getContainerConfig()` sets NEO4J_AUTH (neo4j/password format)
  - [ ] `getContainerConfig()` maps ports correctly (7687 BOLT, 7474 HTTP)
  - [ ] `getContainerConfig()` creates volume mount for data persistence
- [ ] **Container Creation Tests**:
  - [ ] `createInstance()` creates Docker container via InstanceService
  - [ ] `createInstance()` waits for Neo4j readiness
  - [ ] `createInstance()` returns container info with correct ports/host
- [ ] **Health Check Tests**:
  - [ ] `checkHealth()` returns healthy when Neo4j is running (HTTP endpoint check)
  - [ ] `checkHealth()` returns unhealthy when Neo4j is stopped
  - [ ] `checkHealth()` handles authentication errors
- [ ] **Backup/Restore Tests**:
  - [ ] `backupDatabase()` creates Neo4j backup (neo4j-admin backup)
  - [ ] `backupDatabase()` uploads to storage_manager
  - [ ] `restoreDatabase()` downloads from storage_manager
  - [ ] `restoreDatabase()` restores using neo4j-admin restore

#### 6.2.6 Elasticsearch Handler Tests (`tests/unit/services/databases/elasticsearch.test.js`)
- [ ] **Container Configuration Tests**:
  - [ ] `getContainerConfig()` returns correct Docker config with elasticsearch:8 image
  - [ ] `getContainerConfig()` sets ELASTIC_PASSWORD, xpack.security.enabled
  - [ ] `getContainerConfig()` maps port correctly (default 9200)
  - [ ] `getContainerConfig()` creates volume mount for data persistence
- [ ] **Container Creation Tests**:
  - [ ] `createInstance()` creates Docker container via InstanceService
  - [ ] `createInstance()` waits for Elasticsearch readiness
  - [ ] `createInstance()` returns container info with correct port/host
- [ ] **Health Check Tests**:
  - [ ] `checkHealth()` returns healthy when Elasticsearch cluster is green/yellow
  - [ ] `checkHealth()` returns unhealthy when cluster is red
  - [ ] `checkHealth()` uses _cluster/health API correctly
  - [ ] `checkHealth()` handles authentication errors
- [ ] **Backup/Restore Tests**:
  - [ ] `backupDatabase()` creates snapshot backup
  - [ ] `backupDatabase()` uploads to storage_manager
  - [ ] `restoreDatabase()` downloads from storage_manager
  - [ ] `restoreDatabase()` restores using snapshot API

### 6.2 Integration Tests
- [x] Test API endpoints (`tests/integration/api.test.js`):
  - [x] POST /api/databases (create with encryption)
  - [x] GET /api/databases (list with filters)
  - [x] GET /api/databases/:name (get details)
  - [x] GET /api/databases/:name/connection (decrypt connection string)
  - [x] DELETE /api/databases/:name
  - [x] Error handling (400, 404, 409, 503)
- [x] Test service registration (via index.js startup)
- [x] Test database creation with encryption (via DatabaseService tests)
- [ ] Test backup creation and restore (when BackupService implemented)
- [x] Test connection string generation and decryption

### 6.3 Integration Tests (Database Type Handlers)
- [ ] **PostgreSQL Integration Tests** (`tests/integration/databases/postgresql.test.js`):
  - [ ] Create PostgreSQL database via API
  - [ ] Verify container is running
  - [ ] Verify health check returns healthy
  - [ ] Get connection string from API
  - [ ] Connect to database using aerekos-record with connection string
  - [ ] Create model using aerekos-record
  - [ ] Create records using aerekos-record
  - [ ] Query records using aerekos-record
  - [ ] Update records using aerekos-record
  - [ ] Delete records using aerekos-record
  - [ ] Verify data persistence (stop/start container, verify data still exists)
  - [ ] Stop database and verify health check returns unhealthy
  - [ ] Start database and verify it's accessible again via aerekos-record
  - [ ] Delete database and verify container/volume cleanup
- [ ] **SQLite3 Integration Tests** (`tests/integration/databases/sqlite3.test.js`):
  - [ ] Create SQLite3 database via API
  - [ ] Verify database file exists at correct path
  - [ ] Verify health check returns healthy
  - [ ] Connect to database using aerekos-record with connection string from API
  - [ ] Create model using aerekos-record
  - [ ] Create records using aerekos-record
  - [ ] Query records using aerekos-record
  - [ ] Update records using aerekos-record
  - [ ] Delete records using aerekos-record
  - [ ] Verify data persistence (close connection, reopen, verify data still exists)
  - [ ] Delete database file and verify health check returns unhealthy
  - [ ] Delete database via API and verify file cleanup
  - [ ] Test multiple SQLite3 databases in same project (isolation)
  - [ ] Test SQLite3 databases across different projects (isolation)
- [ ] **MongoDB Integration Tests** (`tests/integration/databases/mongodb.test.js`):
  - [ ] Create MongoDB database via API
  - [ ] Verify container is running
  - [ ] Verify health check returns healthy
  - [ ] Connect to database using MongoDB driver
  - [ ] Create collections and insert documents
  - [ ] Stop database and verify health check returns unhealthy
  - [ ] Delete database and verify container/volume cleanup
- [ ] **Redis Integration Tests** (`tests/integration/databases/redis.test.js`):
  - [ ] Create Redis database via API
  - [ ] Verify container is running
  - [ ] Verify health check returns healthy
  - [ ] Connect to Redis using redis client
  - [ ] Set/get keys
  - [ ] Stop database and verify health check returns unhealthy
  - [ ] Delete database and verify container/volume cleanup
- [ ] **Neo4j Integration Tests** (`tests/integration/databases/neo4j.test.js`):
  - [ ] Create Neo4j database via API
  - [ ] Verify container is running
  - [ ] Verify health check returns healthy
  - [ ] Connect to Neo4j using Neo4j driver
  - [ ] Create nodes and relationships
  - [ ] Stop database and verify health check returns unhealthy
  - [ ] Delete database and verify container/volume cleanup
- [ ] **Elasticsearch Integration Tests** (`tests/integration/databases/elasticsearch.test.js`):
  - [ ] Create Elasticsearch database via API
  - [ ] Verify container is running
  - [ ] Verify health check returns healthy
  - [ ] Connect to Elasticsearch using Elasticsearch client
  - [ ] Create indices and index documents
  - [ ] Stop database and verify health check returns unhealthy
  - [ ] Delete database and verify container/volume cleanup

### 6.4 End-to-End Tests
- [ ] Test full database lifecycle (create → start → backup → stop → delete) for each database type
- [ ] Test backup and restore flow for each database type
- [ ] Test worker selection logic
- [ ] Test port allocation
- [ ] Test project-scoped database isolation
- [ ] Test concurrent database creation

## Phase 7: Documentation

### 7.1 OpenAPI Specification
- [ ] Create `api/openapi.yaml` with full API documentation
- [ ] Include all endpoints, request/response schemas
- [ ] Include authentication requirements
- [ ] Include error responses

### 7.2 README
- [ ] Service overview
- [ ] Setup instructions
- [ ] Configuration guide
- [ ] Supported database types
- [ ] Usage examples

## API Documentation (OpenAPI)

```yaml
openapi: 3.0.0
info:
  title: Database Manager Service API
  version: 1.0.0
  description: Database instance management service for aerekos-cloud

servers:
  - url: http://localhost:3004
    description: Local development
  - url: https://conductor.example.com/api/services/db_manager
    description: Production (via conductor)

paths:
  /api/databases:
    post:
      summary: Create a new database instance
      tags: [Databases]
      security:
        - ServiceToken: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [name, type]
              properties:
                name:
                  type: string
                  description: Unique database name
                  example: "my-app-db"
                type:
                  type: string
                  enum: [postgresql, mongodb, neo4j, elasticsearch, redis]
                  example: "postgresql"
                worker_id:
                  type: string
                  description: Specific worker ID (optional, auto-selects if not provided)
                resource_limits:
                  type: object
                  properties:
                    cpu_cores:
                      type: number
                    ram_gb:
                      type: number
                    disk_gb:
                      type: number
                metadata:
                  type: object
      responses:
        '201':
          description: Database created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DatabaseInstance'
        '400':
          description: Invalid request
        '409':
          description: Database already exists
    
    get:
      summary: List all databases
      tags: [Databases]
      security:
        - ServiceToken: []
      parameters:
        - name: type
          in: query
          schema:
            type: string
            enum: [postgresql, mongodb, neo4j, elasticsearch, redis]
        - name: worker_id
          in: query
          schema:
            type: string
        - name: status
          in: query
          schema:
            type: string
            enum: [creating, running, stopped, failed]
      responses:
        '200':
          description: List of databases
          content:
            application/json:
              schema:
                type: object
                properties:
                  databases:
                    type: array
                    items:
                      $ref: '#/components/schemas/DatabaseInstance'

  /api/databases/{name}:
    get:
      summary: Get database details
      tags: [Databases]
      security:
        - ServiceToken: []
      parameters:
        - name: name
          in: path
          required: true
      responses:
        '200':
          description: Database details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DatabaseInstance'
        '404':
          description: Database not found
    
    delete:
      summary: Delete database instance
      tags: [Databases]
      security:
        - ServiceToken: []
      responses:
        '204':
          description: Database deleted
        '404':
          description: Database not found

  /api/databases/{name}/connection:
    get:
      summary: Get database connection string
      tags: [Databases]
      security:
        - ServiceToken: []
      parameters:
        - name: name
          in: path
          required: true
      responses:
        '200':
          description: Connection string
          content:
            application/json:
              schema:
                type: object
                properties:
                  connection_string:
                    type: string
                  username:
                    type: string
                  password:
                    type: string
                  host:
                    type: string
                  port:
                    type: integer
                  database:
                    type: string

  /api/databases/{name}/backups:
    post:
      summary: Create database backup
      tags: [Backups]
      security:
        - ServiceToken: []
      parameters:
        - name: name
          in: path
          required: true
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                backup_type:
                  type: string
                  enum: [full, incremental]
                  default: full
      responses:
        '201':
          description: Backup created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DatabaseBackup'
    
    get:
      summary: List database backups
      tags: [Backups]
      security:
        - ServiceToken: []
      responses:
        '200':
          description: List of backups
          content:
            application/json:
              schema:
                type: object
                properties:
                  backups:
                    type: array
                    items:
                      $ref: '#/components/schemas/DatabaseBackup'

  /api/databases/{name}/backups/{backupId}/restore:
    post:
      summary: Restore database from backup
      tags: [Backups]
      security:
        - ServiceToken: []
      parameters:
        - name: name
          in: path
          required: true
        - name: backupId
          in: path
          required: true
      responses:
        '200':
          description: Backup restored successfully
        '404':
          description: Backup not found

  /health:
    get:
      summary: Health check
      tags: [Health]
      responses:
        '200':
          description: Service is healthy
        '503':
          description: Service is unhealthy

  /ready:
    get:
      summary: Readiness check
      tags: [Health]
      responses:
        '200':
          description: Service is ready
        '503':
          description: Service is not ready

components:
  schemas:
    DatabaseInstance:
      type: object
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
        type:
          type: string
          enum: [postgresql, mongodb, neo4j, elasticsearch, redis]
        worker_id:
          type: string
        status:
          type: string
          enum: [creating, running, stopped, failed]
        port:
          type: integer
        resource_limits:
          type: object
        created_at:
          type: string
          format: date-time
    
    DatabaseBackup:
      type: object
      properties:
        id:
          type: string
          format: uuid
        database_instance_id:
          type: string
        backup_type:
          type: string
        storage_path:
          type: string
        size_bytes:
          type: integer
        status:
          type: string
        created_at:
          type: string
          format: date-time

  securitySchemes:
    ServiceToken:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: Service-to-service token issued by conductor
```

## How Other Services Use db_manager

**For agents implementing key_manager, storage_manager, or other services that need databases:**

### Creating a Database

```javascript
const axios = require('axios');

async function createDatabase(databaseName, dbType = 'postgresql') {
  const conductorUrl = process.env.CONDUCTOR_URL;
  const serviceToken = process.env.SERVICE_TOKEN;
  
  try {
    const response = await axios.post(
      `${conductorUrl}/api/services/db_manager/api/databases`,
      {
        name: databaseName,
        type: dbType,  // 'postgresql', 'mongodb', 'neo4j', 'elasticsearch', 'redis'
        metadata: {
          service: 'your_service_name',
          description: 'Database for your service'
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${serviceToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000  // Database creation can take time
      }
    );
    
    // Response includes:
    // {
    //   id: "uuid",
    //   name: "your-service-db",
    //   type: "postgresql",
    //   connection_string: "postgresql://user:pass@host:port/db",
    //   username: "user",
    //   password: "pass",
    //   host: "host",
    //   port: 5432,
    //   database: "db",
    //   status: "running"
    // }
    
    return response.data;
  } catch (error) {
    if (error.response?.status === 409) {
      throw new Error(`Database '${databaseName}' already exists`);
    }
    throw new Error(`Failed to create database: ${error.message}`);
  }
}
```

### Getting Connection String

```javascript
async function getConnectionString(databaseName) {
  const response = await axios.get(
    `${conductorUrl}/api/services/db_manager/api/databases/${databaseName}/connection`,
    {
      headers: {
        'Authorization': `Bearer ${serviceToken}`
      }
    }
  );
  
  return response.data.connection_string;
}
```

### Using the Database with aerekos-record

```javascript
const Record = require('../../services/aerekos-record');

async function connectToDatabase(databaseName) {
  const dbInfo = await getConnectionString(databaseName);
  
  // Parse connection string or use individual fields
  const db = Record.connect(dbInfo.type, {
    host: dbInfo.host,
    port: dbInfo.port,
    database: dbInfo.database,
    user: dbInfo.username,
    password: dbInfo.password
  });
  
  return db;
}
```

### Listing Databases

```javascript
async function listDatabases(filter = {}) {
  const response = await axios.get(
    `${conductorUrl}/api/services/db_manager/api/databases`,
    {
      params: filter,  // { type: 'postgresql', worker_id: '...' }
      headers: {
        'Authorization': `Bearer ${serviceToken}`
      }
    }
  );
  
  return response.data.databases;
}
```

### Error Handling

- **404 Not Found**: Database doesn't exist - create it first
- **401 Unauthorized**: Service token invalid - re-register with conductor
- **500 Server Error**: db_manager is down - use SQLite fallback for development

## Dependencies

### External Services
- **Conductor**: Service registration, routing, authentication
- **storage_manager**: Backup storage (optional - can store backups locally initially)
- **Worker**: Docker container management for database instances (REQUIRED)

### Service Consumers
- **All services**: Database creation and management
- **key_manager**: Database for key storage (but key_manager uses SQLite directly)
- **storage_manager**: Database for metadata
- **api_manager**: Database selection for user APIs

## Next Steps

After completing this plan:
1. Test database creation across different types
2. Test backup and restore functionality
3. Test integration with storage_manager
4. Implement enterprise features (monitoring, alerting)

