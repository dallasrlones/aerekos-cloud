# Storage Manager Service (S3-like) Implementation Plan

## ✅ STATUS: BACKEND COMPLETE | FRONTEND MOSTLY COMPLETE

**Backend Status**: ✅ Complete (Phases 1-7)
- All backend implementation complete
- Comprehensive test suite implemented
- All API endpoints working

**Frontend Status**: ✅ Mostly Complete (Phase 8)
- ✅ Service management screen implemented (StorageManager.jsx)
- ✅ Projects list screen implemented (ProjectsList.jsx)
- ✅ Buckets list screen implemented (BucketsList.jsx)
- ✅ Bucket details screen implemented (BucketDetails.jsx)
- ✅ File details screen implemented (FileDetails.jsx)
- ✅ Bucket config screen implemented (BucketConfig.jsx)
- ✅ File upload/download functionality
- ✅ Navigation integration complete
- ⏳ Some Phase 8 items may still need completion (see Phase 8 checklist below)

**Priority**: HIGH - Foundation service for object storage across the platform

## Quick Start for Agents

**CAN BE IMPLEMENTED IN PARALLEL WITH**: key_manager and db_manager

**Dependencies**:
- ✅ Conductor (must be running)
- ✅ **key_manager** (REQUIRED - for encryption. Service will fail to start if key_manager is unavailable unless MOCK_KEY_MANAGER=true)
- ⚠️ db_manager (can use SQLite fallback initially)

**Key Implementation Points**:
1. S3-compatible API endpoints
2. Integration with key_manager for encryption (REQUIRED - see "How to Use key_manager" section)
   - **Development mode**: Can use MOCK_KEY_MANAGER=true for testing without key_manager
   - **Production mode**: REQUIRES key_manager to be running and accessible
3. Bucket and object management
4. Service registration with conductor

**CRITICAL**: This service REQUIRES key_manager for encryption. Every file MUST be encrypted using keys from key_manager. The service will fail to start if key_manager is not available (unless MOCK_KEY_MANAGER=true for development).

**See "How Other Services Use storage_manager" section below for integration examples.**

## Overview

Storage Manager Service provides S3-compatible object storage for aerekos-cloud. It handles file uploads, downloads, encryption (via key_manager), and storage management with a hierarchical structure: **Projects → Buckets → Files**.

**Key Features**:
- **Project-based organization**: Projects contain buckets, buckets contain files
- **Automatic encryption**: Every file is encrypted using keys from key_manager
- **Chunked uploads**: Support for large file uploads via multipart/chunked uploads
- **Massive file support**: Handle files of any size efficiently
- **Signed URLs**: Generate time-limited signed URLs for upload/download with TTLs

**Follow**: [../../plan.md](../../plan.md) for high-level roadmap and architecture overview.

## Host drives, devices & performance *(product requirement)*

**Goal**: Aerekos storage should be able to **detect drives on devices** (the machines running workers / storage) and characterize **drive speed**, so operators and automation can reason about capacity, placement, and performance—not only the configured object root.

### What to detect

| Signal | Use |
|--------|-----|
| **Block / volume inventory** | Device name, size, filesystem type, mount point, free space |
| **Logical ↔ physical mapping** | Which mount backs `STORAGE_PATH` (and optional alternate data roots) |
| **Device class** | Fixed vs removable; SSD vs HDD vs unknown (from OS hints where available) |
| **Speed / throughput** | Sequential read/write (MB/s), optional latency; sufficient to compare tiers (e.g. NVMe vs USB disk) |

### Implementation approaches *(pick one or combine)*

1. **Worker agent (recommended for bare-metal truth)**  
   The **worker** already runs on the host and can use libraries such as **`systeminformation`** (used elsewhere in this repo) to list disks, block devices, and filesystems without the storage container needing `/dev` access.

2. **storage_manager API (operator-facing)**  
   Expose read-only endpoints, e.g. `GET /api/v1/host/storage-devices` and `GET /api/v1/host/storage-benchmark` (or include a `speed` snapshot on the devices payload), implemented by:
   - calling into a small host-side helper, **or**
   - receiving **pushed metrics from the worker** (WebSocket / periodic register payload) that storage_manager and conductor can display.

3. **Docker / Kubernetes caveats**  
   A **container-only** `storage_manager` often sees a single layered filesystem unless the compose stack mounts host paths or devices. For accurate **multi-disk** lists and **raw** speed tests, prefer **privileged patterns only where justified**, or delegate discovery to the **worker process on the host** and forward structured JSON to the control plane.

### Speed measurement guidelines

- Prefer **configurable, bounded** tests (file size cap, duration cap, optional “manual trigger only”) so production nodes are not hammered by default.
- Report **methodology** in the API response (e.g. `sequential_write_128mb`, `cached=false`) so UIs can show comparable numbers.
- Treat numbers as **indicative** unless running on an idle disk with documented parameters.

### Checklist *(implementation — not yet built)*

- [ ] Document canonical JSON schema for a **storage device** (id, mount, size, free, type, optional `read_mbps` / `write_mbps`, `measured_at`).
- [ ] Worker: collect device list + map `STORAGE_PATH` to backing volume (where possible).
- [ ] Optional: worker or storage_manager: run or schedule **throttled** benchmark and attach results to device records.
- [ ] Conductor / dashboard: surface device list and speed hints on Storage Manager or worker detail views.
- [ ] Tests: unit tests for parsing/mapping; integration tests gated on CI capability (mock SI data).

## Implementation Order

**This service REQUIRES key_manager to be running**. It can be implemented in parallel with db_manager.

**Development vs Production**:
- **Development**: Can use `MOCK_KEY_MANAGER=true` to stub key_manager calls for testing
- **Production**: REQUIRES key_manager to be running and accessible. Service will fail to start if key_manager is unavailable.

**Dependencies**:
- ✅ **key_manager**: REQUIRED - Must be running and accessible (unless MOCK_KEY_MANAGER=true for development)
- ⚠️ **db_manager**: Can use SQLite fallback initially

## Architecture

### Key Features
- **S3-Compatible API**: Compatible with AWS S3 API for easy integration
- **Encryption**: Automatic encryption using keys from key_manager
- **Bucket Management**: Create, list, delete buckets
- **Object Storage**: Upload, download, delete objects
- **Metadata Support**: Custom metadata for objects
- **Access Control**: Service-to-service authentication via conductor tokens
- **High Availability**: Can be deployed across multiple workers
- **Enterprise Features**: Health checks, metrics, audit logging

### Service Dependencies
- **Conductor**: Service registration, routing, authentication
- **key_manager**: Encryption keys for object encryption
- **db_manager**: Database for metadata and bucket management

### Service Consumers
- **All services**: Object storage needs (files, backups, assets)
- **db_manager**: Backup storage
- **api_manager**: File uploads for APIs

## Phase 1: Initial Setup & Configuration

### 1.1 Project Structure
- [ ] Create folder structure:
  - `api/` - Express API server
  - `api/routes/` - API routes (S3-compatible)
  - `api/services/` - Business logic (StorageService, BucketService, ObjectService)
  - `api/repos/` - Data access (BucketRepository, ObjectRepository)
  - `api/middleware/` - Express middleware (S3 signature validation, auth)
  - `api/utils/` - Utility functions (encryption, multipart upload)
  - `scripts/` - Utility scripts (entrypoint, cleanup)
  - `storage/` - Object storage directory (gitignored)
  - `tests/` - Test files

### 1.2 Environment Configuration
- [ ] Create `.env_example` with:
  - `PORT` - Service port (default: 3003, auto-detect if in use)
  - `CONDUCTOR_URL` - Conductor API URL
  - `SERVICE_NAME` - Service name (default: `storage_manager`)
  - `SERVICE_VERSION` - Service version (e.g., `1.0.0`)
  - `KEY_MANAGER_URL` - key_manager service URL (via conductor: `/api/services/key_manager`)
  - `DB_MANAGER_URL` - db_manager service URL (via conductor: `/api/services/db_manager`)
  - `STORAGE_PATH` - Storage root directory (default: `/app/storage`)
  - `MAX_FILE_SIZE` - Max file size in bytes (default: `10737418240` = 10GB)
  - `ENCRYPTION_ENABLED` - Enable encryption (default: `true`)
  - `DEFAULT_ENCRYPTION_KEY` - Default encryption key name (default: `storage-encryption-key`)
  - `LOG_LEVEL` - Logging level (default: `info`)
  - `NODE_ENV` - Environment (development/production)

### 1.3 Package Dependencies
- [ ] Create `package.json` with:
  - `express` - Web framework
  - `dotenv` - Environment variables
  - `multer` - File upload handling
  - `aws-sdk` or `@aws-sdk/client-s3` - S3 SDK (optional, for compatibility)
  - `axios` - HTTP client for conductor/key_manager/db_manager calls
  - `crypto` - Built-in Node.js crypto (for encryption)
  - `stream` - Stream handling for large files
  - `joi` - Input validation
  - `winston` - Structured logging
  - `mime-types` - MIME type detection
  - **`aerekos-record`** - **REQUIRED**: ORM for all database models (must be installed)
  - `jest` - Testing framework
  - `supertest` - API testing

**Note**: aerekos-record is located at `../../services/aerekos-record` in the worker directory. You can either:
- Copy it to each service's `node_modules`, OR
- Use a symlink, OR
- Reference it directly: `const Record = require('../../services/aerekos-record')`

### 1.4 Docker Setup
- [ ] Create `Dockerfile` (production)
- [ ] Create `Dockerfile.dev` (development with nodemon)
- [ ] Create `docker-compose.yml`:
  - Mount storage directory: `./storage:/app/storage`
  - Mount data directory: `./data:/app/data`
  - Environment variables
  - Health check: `GET /health`
  - Network: Connect to worker network

## Phase 2: Database Setup

### 2.1 Database Creation via db_manager

**IMPORTANT**: This service uses db_manager for its metadata database. If db_manager is not yet implemented, you can use SQLite directly for initial development, then migrate later.

**Option A: Use db_manager (Recommended for production)**:
- [ ] Create `api/utils/dbClient.js`:
  ```javascript
  const axios = require('axios');
  const Record = require('../../services/aerekos-record');
  
  let db = null;
  
  async function initializeDatabase() {
    const conductorUrl = process.env.CONDUCTOR_URL;
    const serviceToken = process.env.SERVICE_TOKEN;
    const dbManagerUrl = `${conductorUrl}/api/services/db_manager`;
    
    try {
      // Request database creation via db_manager
      const response = await axios.post(
        `${dbManagerUrl}/api/databases`,
        {
          name: 'storage_manager_metadata',
          type: 'postgresql',  // or 'mongodb' for NoSQL
          metadata: {
            service: 'storage_manager',
            description: 'Storage Manager metadata database'
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
      
      const { connection_string, username, password, host, port, database } = response.data;
      
      // Connect using aerekos-record
      db = Record.connect('postgresql', {
        host,
        port,
        database,
        user: username,
        password
      });
      
      console.log('[storage_manager] Database created and connected via db_manager');
      return db;
    } catch (error) {
      console.error('[storage_manager] Database creation via db_manager failed:', error.message);
      throw error;
    }
  }
  
  // Fallback to SQLite for development
  async function initializeDatabaseFallback() {
    const path = require('path');
    const fs = require('fs');
    const Record = require('../../services/aerekos-record');
    
    const dbPath = path.join(__dirname, '../../data/storage_manager.db');
    const dataDir = path.dirname(dbPath);
    
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    db = Record.connect('sqlite', {
      database: dbPath
    });
    
    console.log('[storage_manager] Using SQLite fallback database');
    return db;
  }
  
  // Try db_manager first, fallback to SQLite
  async function getDatabase() {
    if (db) return db;
    
    try {
      return await initializeDatabase();
    } catch (error) {
      console.warn('[storage_manager] Falling back to SQLite:', error.message);
      return await initializeDatabaseFallback();
    }
  }
  
  module.exports = { getDatabase, initializeDatabase, initializeDatabaseFallback };
  ```

**Option B: Use SQLite directly (for initial development)**:
- [ ] Create `api/utils/dbClient.js`:
  ```javascript
  const path = require('path');
  const fs = require('fs');
  const Record = require('../../services/aerekos-record');
  
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/storage_manager.db');
  const dataDir = path.dirname(dbPath);
  
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  const db = Record.connect('sqlite', {
    database: dbPath
  });
  
  module.exports = db;
  ```

### 2.2 Database Models (using aerekos-record)

**CRITICAL**: All models MUST use aerekos-record. Never use raw SQL or other ORMs.

**Hierarchy**: Projects → Buckets → Files

- [ ] Create `api/models/index.js`:
  ```javascript
  const db = require('../utils/dbClient');
  
  // Project Model (top level)
  const Project = db.model('Project', {
    name: 'string',
    created_by: 'string',  // Service that created project
    metadata: 'string'  // JSON string for additional metadata
  }, {
    required: ['name'],
    unique: ['name'],
    timestamps: true,
    hasMany: ['Bucket']  // Projects have many buckets
  });
  
  // Bucket Model (belongs to Project)
  const Bucket = db.model('Bucket', {
    project_id: 'string',  // Foreign key to Project
    name: 'string',
    created_by: 'string',  // Service that created bucket
    encryption_key_name: 'string',  // Key name from key_manager (all files encrypted)
    metadata: 'string'  // JSON string for additional metadata
  }, {
    required: ['project_id', 'name'],
    unique: ['project_id', 'name'],  // Unique within project
    belongsTo: ['Project'],  // Creates project_id foreign key
    hasMany: ['File'],  // Buckets have many files
    timestamps: true
  });
  
  // File Model (belongs to Bucket, which belongs to Project)
  const File = db.model('File', {
    bucket_id: 'string',  // Foreign key to Bucket
    key: 'string',  // File key/path within bucket
    size: 'number',  // File size in bytes
    content_type: 'string',  // MIME type
    etag: 'string',  // ETag for versioning
    encryption_key_version: 'number',  // Key version used for encryption
    storage_path: 'string',  // Physical encrypted file path
    chunk_count: 'number',  // Number of chunks (for chunked uploads)
    chunk_size: 'number',  // Size of each chunk in bytes
    upload_id: 'string',  // Multipart upload ID (for chunked uploads)
    upload_status: 'string',  // 'pending', 'in_progress', 'completed', 'failed'
    metadata: 'string'  // JSON string for custom metadata
  }, {
    required: ['bucket_id', 'key', 'size', 'storage_path'],
    unique: ['bucket_id', 'key'],  // Unique within bucket
    belongsTo: ['Bucket'],  // Creates bucket_id foreign key
    timestamps: true
  });
  
  // FileChunk Model (for chunked uploads)
  const FileChunk = db.model('FileChunk', {
    file_id: 'string',  // Foreign key to File
    chunk_number: 'number',  // Chunk sequence number (1, 2, 3, ...)
    chunk_path: 'string',  // Physical path to encrypted chunk
    chunk_size: 'number',  // Size of this chunk
    etag: 'string',  // ETag for this chunk
    upload_status: 'string'  // 'pending', 'uploaded', 'completed'
  }, {
    required: ['file_id', 'chunk_number', 'chunk_path'],
    unique: ['file_id', 'chunk_number'],  // Unique chunk number per file
    belongsTo: ['File'],
    timestamps: true
  });
  
  // SignedUrl Model (for signed upload/download URLs)
  const SignedUrl = db.model('SignedUrl', {
    file_id: 'string',  // Foreign key to File (nullable for bucket-level URLs)
    bucket_id: 'string',  // Foreign key to Bucket
    url_type: 'string',  // 'upload' or 'download'
    url: 'string',  // The signed URL
    expires_at: 'datetime',  // TTL expiration time
    used: 'number',  // 0 = false, 1 = true (track if URL was used)
    used_at: 'datetime',  // When URL was used (nullable)
    metadata: 'string'  // JSON string for additional data
  }, {
    required: ['bucket_id', 'url_type', 'url', 'expires_at'],
    belongsTo: ['File', 'Bucket'],
    timestamps: true
  });
  
  // FileAccess Model (audit log)
  const FileAccess = db.model('FileAccess', {
    file_id: 'string',  // Foreign key to File
    service_name: 'string',
    action: 'string',  // 'get', 'put', 'delete', 'list', 'upload_chunk', 'download'
    timestamp: 'datetime',
    ip_address: 'string',
    success: 'number'  // 0 = false, 1 = true
  }, {
    required: ['file_id', 'service_name', 'action', 'timestamp'],
    belongsTo: ['File'],
    timestamps: false  // We use timestamp field instead
  });
  
  module.exports = {
    Project,
    Bucket,
    File,
    FileChunk,
    SignedUrl,
    FileAccess,
    db
  };
  ```

**Model Usage Examples**:
```javascript
const { Bucket, Object, ObjectAccess } = require('../models');

// Create a bucket
const bucket = await Bucket.create({
  name: 'my-bucket',
  created_by: 'storage_manager',
  encryption_enabled: 1,
  encryption_key_name: 'storage-encryption-key',
  metadata: JSON.stringify({ description: 'My storage bucket' })
});

// Find bucket by name
const foundBucket = await Bucket.findAll({ where: { name: 'my-bucket' } });

// Create an object
const object = await Object.create({
  bucket_id: bucket.id,
  key: 'path/to/file.txt',
  size: 1024,
  content_type: 'text/plain',
  etag: 'abc123',
  encrypted: 1,
  encryption_key_version: 1,
  storage_path: '/app/storage/bucket/object-id',
  metadata: JSON.stringify({})
});

// Find objects in bucket
const objects = await Object.findAll({
  where: { bucket_id: bucket.id },
  limit: 100
});

// Log object access
await ObjectAccess.create({
  object_id: object.id,
  service_name: 'api_manager',
  action: 'get',
  timestamp: new Date().toISOString(),
  ip_address: '127.0.0.1',
  success: 1
});
```

### 2.3 Database Initialization
- [ ] Create database initialization script
- [ ] Create tables/indexes on first startup
- [ ] Set up indexes for performance (bucket_name, object_key)

## Phase 3: Core Storage Logic

### 3.1 Project Service
- [ ] Create `api/services/ProjectService.js`:
  - `createProject(name, metadata)` - Create new project
  - `getProject(projectId)` - Get project details
  - `listProjects(filter)` - List all projects
  - `deleteProject(projectId)` - Delete project (must be empty)
  - `updateProject(projectId, updates)` - Update project metadata

### 3.2 Bucket Service
- [ ] Create `api/services/BucketService.js`:
  - `createBucket(projectId, name, metadata)` - Create bucket in project
  - `getBucket(projectId, bucketName)` - Get bucket details
  - `listBuckets(projectId, filter)` - List buckets in project
  - `deleteBucket(projectId, bucketName)` - Delete bucket (must be empty)
  - `updateBucket(projectId, bucketName, updates)` - Update bucket settings

### 3.3 Storage Service (File Operations)
- [ ] Create `api/services/StorageService.js`:
  - `uploadFile(projectId, bucketName, key, fileStream, metadata)` - Upload file (encrypted)
  - `downloadFile(projectId, bucketName, key)` - Download file (decrypted)
  - `deleteFile(projectId, bucketName, key)` - Delete file
  - `listFiles(projectId, bucketName, prefix, maxKeys)` - List files in bucket
  - `getFileMetadata(projectId, bucketName, key)` - Get file metadata
  - `copyFile(sourceProject, sourceBucket, sourceKey, destProject, destBucket, destKey)` - Copy file
  - `encryptFile(fileStream, keyName)` - Encrypt file using key_manager (ALWAYS encrypt)
  - `decryptFile(encryptedStream, keyName, keyVersion)` - Decrypt file

### 3.4 Chunked Upload Service
- [ ] Create `api/services/ChunkedUploadService.js`:
  - `initiateChunkedUpload(projectId, bucketName, key, totalSize, chunkSize, metadata)` - Start chunked upload
  - `uploadChunk(uploadId, chunkNumber, chunkData)` - Upload single chunk
  - `completeChunkedUpload(uploadId, chunkETags)` - Complete and merge chunks
  - `abortChunkedUpload(uploadId)` - Cancel chunked upload
  - `getChunkedUploadStatus(uploadId)` - Get upload progress
  - `mergeChunks(fileId, chunks)` - Merge encrypted chunks into final file

### 3.5 Signed URL Service
- [ ] Create `api/services/SignedUrlService.js`:
  - `generateSignedUploadUrl(projectId, bucketName, key, ttlSeconds, metadata)` - Generate signed upload URL
  - `generateSignedDownloadUrl(projectId, bucketName, key, ttlSeconds)` - Generate signed download URL
  - `validateSignedUrl(signedUrl)` - Validate signed URL and check expiration
  - `revokeSignedUrl(signedUrlId)` - Revoke signed URL before expiration
  - `listSignedUrls(projectId, bucketName, filter)` - List active signed URLs
  - `cleanupExpiredUrls()` - Clean up expired signed URLs (cron job)

### 3.6 Encryption Integration

**CRITICAL**: Every file MUST be encrypted. No unencrypted files should ever be stored.

**Parallel Development Note**: During parallel development with key_manager, you can:
1. **Stub key_manager calls** with mock responses:
   ```javascript
   // api/services/EncryptionService.js (during development)
   async getEncryptionKey(keyName) {
     // TODO: Replace with real key_manager call when ready
     if (process.env.MOCK_KEY_MANAGER === 'true') {
       return {
         key_material: 'mock-key-material-for-development-only',
         key_version: 1
       };
     }
     
     // Real implementation (use when key_manager is ready)
     const response = await axios.get(
       `${this.conductorUrl}/api/services/key_manager/api/keys/${keyName}`,
       { headers: { 'Authorization': `Bearer ${this.serviceToken}` } }
     );
     return response.data;
   }
   ```

2. **Implement encryption logic** using the stub (it will work the same way)
3. **Replace stub** with real API calls once key_manager is ready

**CRITICAL**: This service depends on key_manager. All encryption operations must use keys from key_manager via conductor API.

- [ ] Create `api/services/EncryptionService.js`:
  ```javascript
  const axios = require('axios');
  const crypto = require('crypto');
  const { Transform } = require('stream');
  
  class EncryptionService {
    constructor(conductorUrl, serviceToken) {
      this.conductorUrl = conductorUrl;
      this.serviceToken = serviceToken;
    }
    
    /**
     * Get encryption key from key_manager via conductor
     * @param {string} keyName - Key name (e.g., 'storage-encryption-key')
     * @returns {Promise<object>} Key object with decrypted key material
     */
    async getEncryptionKey(keyName) {
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
        
        // Note: key_manager returns encrypted key, but we need the actual key material
        // For now, key_manager will need to provide a way to get the decrypted key
        // This is a placeholder - actual implementation depends on key_manager API
        return response.data;
      } catch (error) {
        if (error.response?.status === 404) {
          throw new Error(`Encryption key '${keyName}' not found in key_manager`);
        }
        throw new Error(`Failed to get encryption key: ${error.message}`);
      }
    }
    
    /**
     * Encrypt a stream using a key from key_manager
     * @param {stream.Readable} inputStream - Input stream to encrypt
     * @param {string} keyName - Key name from key_manager
     * @returns {stream.Transform} Encrypted stream
     */
    async encryptStream(inputStream, keyName) {
      const key = await this.getEncryptionKey(keyName);
      
      // Generate random IV for each encryption
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key.key_material, 'hex'), iv);
      
      const transform = new Transform({
        transform(chunk, encoding, callback) {
          const encrypted = cipher.update(chunk);
          callback(null, encrypted);
        },
        flush(callback) {
          const final = cipher.final();
          const authTag = cipher.getAuthTag();
          // Prepend IV and auth tag
          callback(null, Buffer.concat([iv, authTag, final]));
        }
      });
      
      return inputStream.pipe(transform);
    }
    
    /**
     * Decrypt a stream using a key from key_manager
     * @param {stream.Readable} encryptedStream - Encrypted stream
     * @param {string} keyName - Key name from key_manager
     * @param {number} keyVersion - Optional key version
     * @returns {stream.Transform} Decrypted stream
     */
    async decryptStream(encryptedStream, keyName, keyVersion = null) {
      const key = await this.getEncryptionKey(keyName);
      
      return new Transform({
        transform(chunk, encoding, callback) {
          // Extract IV and auth tag (first 16 bytes = IV, next 16 = auth tag)
          const iv = chunk.slice(0, 16);
          const authTag = chunk.slice(16, 32);
          const encrypted = chunk.slice(32);
          
          const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key.key_material, 'hex'), iv);
          decipher.setAuthTag(authTag);
          
          const decrypted = decipher.update(encrypted);
          const final = decipher.final();
          
          callback(null, Buffer.concat([decrypted, final]));
        }
      });
    }
    
    /**
     * Generate ETag for object versioning
     * @param {Buffer|string} data - Data to hash
     * @returns {string} ETag (MD5 hash)
     */
    generateETag(data) {
      return crypto.createHash('md5').update(data).digest('hex');
    }
  }
  
  module.exports = EncryptionService;
  ```

**How to Use key_manager**:
1. **Get Encryption Key**: Call `GET /api/services/key_manager/api/keys/{keyName}` via conductor
2. **Key Format**: key_manager returns key metadata. You'll need to decrypt the key material using the master key (handled by key_manager)
3. **Key Rotation**: When rotating keys, call `POST /api/services/key_manager/api/keys/{keyName}/rotate`
4. **Error Handling**: If key_manager is unavailable, encryption operations should fail gracefully with clear error messages

**Example Usage in StorageService**:
```javascript
const EncryptionService = require('./EncryptionService');

class StorageService {
  constructor() {
    this.encryptionService = new EncryptionService(
      process.env.CONDUCTOR_URL,
      process.env.SERVICE_TOKEN
    );
  }
  
  async uploadObject(bucketName, key, fileStream, metadata) {
    const bucket = await this.getBucket(bucketName);
    
    // Encrypt if bucket has encryption enabled
    if (bucket.encryption_enabled) {
      const encryptionKeyName = bucket.encryption_key_name || 'storage-encryption-key';
      fileStream = await this.encryptionService.encryptStream(fileStream, encryptionKeyName);
    }
    
    // Save encrypted stream to storage
    // ...
  }
}
```

### 3.5 Repository Layer
- [ ] Create `api/repos/BucketRepository.js`:
  - `create(bucketData)` - Create bucket record
  - `findByName(name)` - Find bucket by name
  - `findAll(filter)` - List buckets
  - `update(id, bucketData)` - Update bucket
  - `delete(id)` - Delete bucket
- [ ] Create `api/repos/ObjectRepository.js`:
  - `create(objectData)` - Create object record
  - `findByBucketAndKey(bucketId, key)` - Find object
  - `findByBucket(bucketId, options)` - List objects in bucket
  - `update(id, objectData)` - Update object
  - `delete(id)` - Delete object
  - `logAccess(objectId, accessData)` - Log object access

## Phase 4: S3-Compatible API Endpoints

### 4.1 Project Operations
- [ ] Create `api/routes/projects.js`:
  - `POST /api/projects` - Create project
  - `GET /api/projects` - List all projects
  - `GET /api/projects/:projectId` - Get project details
  - `DELETE /api/projects/:projectId` - Delete project (must be empty)
  - `PATCH /api/projects/:projectId` - Update project metadata

### 4.2 Bucket Operations
- [ ] Create `api/routes/buckets.js`:
  - `POST /api/projects/:projectId/buckets` - Create bucket in project
  - `GET /api/projects/:projectId/buckets` - List buckets in project
  - `GET /api/projects/:projectId/buckets/:bucketName` - Get bucket details
  - `DELETE /api/projects/:projectId/buckets/:bucketName` - Delete bucket (must be empty)
  - `PATCH /api/projects/:projectId/buckets/:bucketName` - Update bucket settings

### 4.3 File Operations

**TASK**: Implement file operations with automatic encryption, chunked uploads, and signed URLs.

- [ ] Create `api/routes/objects.js`:
  ```javascript
  const express = require('express');
  const multer = require('multer');
  const StorageService = require('../services/StorageService');
  const EncryptionService = require('../services/EncryptionService');
  const validateServiceToken = require('../middleware/auth');
  
  const router = express.Router();
  const upload = multer({ dest: '/tmp/uploads' });
  
  // POST /projects/:projectId/buckets/:bucketName/files/:key - Upload file
  router.post('/projects/:projectId/buckets/:bucketName/files/:key(*)', validateServiceToken, upload.single('file'), async (req, res, next) => {
    try {
      const { bucketName, key } = req.params;
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({
          error: { message: 'File is required', status: 400 }
        });
      }
      
      const storageService = new StorageService(
        process.env.CONDUCTOR_URL,
        process.env.SERVICE_TOKEN
      );
      
      const object = await storageService.uploadObject(
        bucketName,
        key,
        fs.createReadStream(file.path),
        {
          content_type: file.mimetype,
          size: file.size,
          metadata: req.body.metadata ? JSON.parse(req.body.metadata) : {}
        }
      );
      
      // Clean up temp file
      fs.unlinkSync(file.path);
      
      res.status(200).json({
        etag: object.etag,
        key: object.key,
        size: object.size,
        content_type: object.content_type
      });
    } catch (error) {
      next(error);
    }
  });
  
  // GET /{bucketName}/{key} - Download object
  router.get('/:bucketName/:key(*)', validateServiceToken, async (req, res, next) => {
    try {
      const { bucketName, key } = req.params;
      
      const storageService = new StorageService(
        process.env.CONDUCTOR_URL,
        process.env.SERVICE_TOKEN
      );
      
      const objectStream = await storageService.downloadObject(bucketName, key);
      
      // Set headers
      res.setHeader('Content-Type', objectStream.content_type);
      res.setHeader('Content-Length', objectStream.size);
      res.setHeader('ETag', objectStream.etag);
      
      // Stream object
      objectStream.stream.pipe(res);
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: { message: 'Object not found', status: 404 }
        });
      }
      next(error);
    }
  });
  
  // HEAD /{bucketName}/{key} - Get object metadata
  router.head('/:bucketName/:key(*)', validateServiceToken, async (req, res, next) => {
    try {
      const { bucketName, key } = req.params;
      
      const storageService = new StorageService(
        process.env.CONDUCTOR_URL,
        process.env.SERVICE_TOKEN
      );
      
      const metadata = await storageService.getObjectMetadata(bucketName, key);
      
      res.setHeader('Content-Length', metadata.size);
      res.setHeader('Content-Type', metadata.content_type);
      res.setHeader('ETag', metadata.etag);
      res.setHeader('Last-Modified', new Date(metadata.updated_at).toUTCString());
      
      res.status(200).end();
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).end();
      }
      next(error);
    }
  });
  
  // DELETE /{bucketName}/{key} - Delete object
  router.delete('/:bucketName/:key(*)', validateServiceToken, async (req, res, next) => {
    try {
      const { bucketName, key } = req.params;
      
      const storageService = new StorageService(
        process.env.CONDUCTOR_URL,
        process.env.SERVICE_TOKEN
      );
      
      await storageService.deleteObject(bucketName, key);
      
      res.status(204).end();
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: { message: 'Object not found', status: 404 }
        });
      }
      next(error);
    }
  });
  
  module.exports = router;
  ```

**Key Integration Points with key_manager**:
1. **Bucket Creation**: When creating bucket with `encryption_enabled: true`, verify key exists:
   ```javascript
   // In BucketService.createBucket()
   if (encryptionEnabled) {
     const keyName = encryptionKeyName || 'storage-encryption-key';
     // Verify key exists in key_manager
     await axios.get(
       `${conductorUrl}/api/services/key_manager/api/keys/${keyName}`,
       { headers: { 'Authorization': `Bearer ${serviceToken}` } }
     );
   }
   ```

2. **Object Upload**: Encrypt stream before saving:
   ```javascript
   // In StorageService.uploadObject()
   if (bucket.encryption_enabled) {
     const encryptionService = new EncryptionService(conductorUrl, serviceToken);
     fileStream = await encryptionService.encryptStream(fileStream, bucket.encryption_key_name);
   }
   ```

3. **Object Download**: Decrypt stream after reading:
   ```javascript
   // In StorageService.downloadObject()
   if (object.encrypted) {
     const encryptionService = new EncryptionService(conductorUrl, serviceToken);
     decryptedStream = await encryptionService.decryptStream(encryptedStream, bucket.encryption_key_name, object.encryption_key_version);
   }
   ```

### 4.4 Chunked Upload Operations
- [ ] Create `api/routes/chunkedUploads.js`:
  - `POST /api/projects/:projectId/buckets/:bucketName/files/:key/upload/initiate` - Initiate chunked upload
  - `PUT /api/projects/:projectId/buckets/:bucketName/files/:key/upload/:uploadId/chunk/:chunkNumber` - Upload chunk
  - `POST /api/projects/:projectId/buckets/:bucketName/files/:key/upload/:uploadId/complete` - Complete chunked upload
  - `DELETE /api/projects/:projectId/buckets/:bucketName/files/:key/upload/:uploadId` - Abort chunked upload
  - `GET /api/projects/:projectId/buckets/:bucketName/files/:key/upload/:uploadId/status` - Get upload status

### 4.5 Signed URL Operations
- [ ] Create `api/routes/signedUrls.js`:
  - `POST /api/projects/:projectId/buckets/:bucketName/files/:key/signed-url/upload` - Generate signed upload URL
  - `POST /api/projects/:projectId/buckets/:bucketName/files/:key/signed-url/download` - Generate signed download URL
  - `GET /api/projects/:projectId/buckets/:bucketName/signed-urls` - List signed URLs
  - `DELETE /api/signed-urls/:signedUrlId` - Revoke signed URL

### 4.6 Signed URL Validation Middleware
- [ ] Create `api/middleware/signedUrlAuth.js`:
  - Validate signed URL signature
  - Check TTL expiration
  - Verify URL hasn't been revoked
  - Track URL usage
  - Handle presigned upload/download requests

### 4.4 Service Registration
- [ ] Create `api/utils/serviceRegistration.js` (similar to key_manager):
  - Auto-register with conductor on startup
  - Call `POST /api/services/register` with service metadata
  - Store service token for future requests
  - Handle registration failures gracefully

### 4.5 Main Application File (index.js)
- [ ] Create `index.js`:
  ```javascript
  require('dotenv').config();
  const express = require('express');
  const cors = require('cors');
  const { registerWithConductor } = require('./api/utils/serviceRegistration');
  const bucketRoutes = require('./api/routes/buckets');
  const objectRoutes = require('./api/routes/objects');
  const errorHandler = require('./api/middleware/errorHandler');
  const validateServiceToken = require('./api/middleware/auth');
  
  const app = express();
  const PORT = process.env.PORT || 3003;
  
  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '10gb' })); // Large file support
  app.use(express.urlencoded({ extended: true }));
  
  // Health checks
  app.get('/health', async (req, res) => {
    try {
      const db = require('./api/utils/dbClient');
      await db.query('SELECT 1');
      
      // Check storage directory is writable
      const fs = require('fs');
      const storagePath = process.env.STORAGE_PATH || '/app/storage';
      fs.accessSync(storagePath, fs.constants.W_OK);
      
      res.status(200).json({ status: 'healthy', service: process.env.SERVICE_NAME });
    } catch (error) {
      res.status(503).json({ status: 'unhealthy', error: error.message });
    }
  });
  
  app.get('/ready', async (req, res) => {
    try {
      const db = require('./api/utils/dbClient');
      await db.query('SELECT 1');
      
      // Check key_manager is accessible
      const axios = require('axios');
      await axios.get(
        `${process.env.CONDUCTOR_URL}/api/services/key_manager/health`,
        { timeout: 3000 }
      );
      
      res.status(200).json({ status: 'ready' });
    } catch (error) {
      res.status(503).json({ status: 'not ready', error: error.message });
    }
  });
  
  // API routes
  app.use('/', validateServiceToken, bucketRoutes);
  app.use('/', validateServiceToken, objectRoutes);
  
  // Error handling
  app.use(errorHandler);
  
  // Start server
  async function startService() {
    try {
      await registerWithConductor();
      app.listen(PORT, () => {
        console.log(`[storage_manager] Server running on port ${PORT}`);
      });
    } catch (error) {
      console.error('[storage_manager] Failed to start:', error);
      process.exit(1);
    }
  }
  
  startService();
  ```

## Phase 5: Health Checks & Monitoring

### 5.1 Health Check Endpoints
- [ ] `GET /health` - Liveness probe:
  - Check service is running
  - Check database connectivity
  - Check storage directory is writable
  - Return 200 if healthy, 503 if unhealthy
- [ ] `GET /ready` - Readiness probe:
  - Check database is ready
  - Check key_manager is accessible
  - Check storage directory is accessible
  - Return 200 if ready, 503 if not ready

### 5.2 Metrics Endpoint
- [ ] `GET /metrics` - Prometheus-style metrics:
  - Bucket count
  - Object count
  - Storage usage (total bytes)
  - Request counts (put, get, delete, list)
  - Error rates
  - Response times

## Phase 6: Testing

### 6.1 Unit Tests

#### ProjectService Tests
- [x] `createProject` - should create a new project
- [x] `createProject` - should throw error if project already exists
- [x] `getProject` - should return project by ID
- [x] `getProject` - should throw error if project not found
- [x] `getProjectByName` - should return project by name
- [x] `getProjectByName` - should throw error if project not found
- [x] `listProjects` - should return list of projects
- [x] `listProjects` - should parse metadata JSON
- [x] `updateProject` - should update project metadata
- [x] `updateProject` - should update project name
- [x] `deleteProject` - should delete empty project
- [x] `deleteProject` - should throw error if project has buckets

#### BucketService Tests
- [x] `createBucket` - should create a new bucket
- [x] `createBucket` - should throw error if project not found
- [x] `createBucket` - should throw error if bucket already exists
- [x] `createBucket` - should use default encryption key if not provided
- [x] `getBucket` - should return bucket by project and name
- [x] `getBucket` - should throw error if bucket not found
- [x] `listBuckets` - should return list of buckets in project
- [x] `listBuckets` - should throw error if project not found
- [x] `updateBucket` - should update bucket settings
- [x] `updateBucket` - should update encryption key name
- [x] `deleteBucket` - should delete empty bucket
- [x] `deleteBucket` - should throw error if bucket has files

#### StorageService Tests
- [x] `uploadFile` - should upload and encrypt file
- [x] `uploadFile` - should throw error if bucket not found
- [x] `uploadFile` - should generate ETag for file
- [x] `uploadFile` - should store encrypted file on disk
- [x] `downloadFile` - should download and decrypt file
- [x] `downloadFile` - should throw error if file not found
- [x] `downloadFile` - should log file access
- [x] `deleteFile` - should delete file and physical storage
- [x] `deleteFile` - should throw error if file not found
- [x] `listFiles` - should return list of files in bucket
- [x] `listFiles` - should support prefix filtering
- [x] `listFiles` - should support maxKeys limit
- [x] `getFileMetadata` - should return file metadata
- [x] `getFileMetadata` - should throw error if file not found
- [x] `copyFile` - should copy file between buckets

#### EncryptionService Tests
- [x] `getEncryptionKey` - should return mock key when MOCK_KEY_MANAGER is true
- [x] `getEncryptionKey` - should call key_manager API when MOCK_KEY_MANAGER is false
- [x] `getEncryptionKey` - should throw error if key_manager returns 404
- [x] `encryptBuffer` - should encrypt buffer
- [x] `encryptBuffer` - should produce different encrypted data for same input (due to IV)
- [x] `decryptBuffer` - should decrypt encrypted buffer
- [x] `decryptBuffer` - should throw error for invalid encrypted data
- [x] `encryptStream` - should encrypt stream
- [x] `decryptStream` - should decrypt stream
- [x] `generateETag` - should generate consistent ETag for same data
- [x] `generateETag` - should generate different ETag for different data
- [x] `generateETag` - should return MD5 hex format

#### ChunkedUploadService Tests
- [x] `initiateChunkedUpload` - should initiate chunked upload
- [x] `initiateChunkedUpload` - should calculate correct chunk count
- [x] `uploadChunk` - should upload a chunk
- [x] `uploadChunk` - should encrypt chunk before storing
- [x] `uploadChunk` - should throw error if upload not found
- [x] `uploadChunk` - should throw error if upload not in progress
- [x] `completeChunkedUpload` - should complete upload and merge chunks
- [x] `completeChunkedUpload` - should decrypt and merge all chunks
- [x] `completeChunkedUpload` - should throw error if chunk count mismatch
- [x] `completeChunkedUpload` - should clean up chunk files after merge
- [x] `abortChunkedUpload` - should abort upload and clean up chunks
- [x] `abortChunkedUpload` - should delete all chunk files
- [x] `getChunkedUploadStatus` - should return upload status
- [x] `getChunkedUploadStatus` - should calculate progress percentage

#### SignedUrlService Tests
- [x] `generateSignedUploadUrl` - should generate signed upload URL
- [x] `generateSignedUploadUrl` - should create placeholder file if not exists
- [x] `generateSignedDownloadUrl` - should generate signed download URL
- [x] `generateSignedDownloadUrl` - should throw error if file not found
- [x] `validateSignedUrl` - should validate valid signed URL
- [x] `validateSignedUrl` - should throw error for invalid signature
- [x] `validateSignedUrl` - should throw error for expired URL
- [x] `validateSignedUrl` - should throw error if URL already used
- [x] `markUrlAsUsed` - should mark URL as used
- [x] `revokeSignedUrl` - should revoke signed URL
- [x] `listSignedUrls` - should list signed URLs for bucket
- [x] `cleanupExpiredUrls` - should cleanup expired URLs

#### Repository Tests
- [x] ProjectRepository - CRUD operations
- [x] BucketRepository - CRUD operations
- [x] FileRepository - CRUD operations
- [x] FileChunkRepository - CRUD operations
- [x] SignedUrlRepository - CRUD operations
- [x] FileAccessRepository - log access operations

### 6.2 Integration Tests

#### Projects API Tests
- [x] `POST /api/projects` - should create a project
- [x] `POST /api/projects` - should return 409 if project already exists
- [x] `POST /api/projects` - should return 400 if name missing
- [x] `GET /api/projects` - should list projects
- [x] `GET /api/projects/:projectId` - should get project details
- [x] `GET /api/projects/:projectId` - should return 404 if not found
- [x] `DELETE /api/projects/:projectId` - should delete project
- [x] `DELETE /api/projects/:projectId` - should return 409 if has buckets
- [x] `PATCH /api/projects/:projectId` - should update project

#### Buckets API Tests
- [x] `POST /api/projects/:projectId/buckets` - should create bucket
- [x] `POST /api/projects/:projectId/buckets` - should return 404 if project not found
- [x] `POST /api/projects/:projectId/buckets` - should return 409 if bucket exists
- [x] `GET /api/projects/:projectId/buckets` - should list buckets
- [x] `GET /api/projects/:projectId/buckets/:bucketName` - should get bucket details
- [x] `GET /api/projects/:projectId/buckets/:bucketName` - should return 404 if not found
- [x] `DELETE /api/projects/:projectId/buckets/:bucketName` - should delete bucket
- [x] `DELETE /api/projects/:projectId/buckets/:bucketName` - should return 409 if has files
- [x] `PATCH /api/projects/:projectId/buckets/:bucketName` - should update bucket

#### Files API Tests
- [x] `POST /api/projects/:projectId/buckets/:bucketName/files/:key` - should upload file
- [x] `POST /api/projects/:projectId/buckets/:bucketName/files/:key` - should return 400 if file missing
- [x] `POST /api/projects/:projectId/buckets/:bucketName/files/:key` - should return 404 if bucket not found
- [x] `GET /api/projects/:projectId/buckets/:bucketName/files/:key` - should download file
- [x] `GET /api/projects/:projectId/buckets/:bucketName/files/:key` - should return 404 if file not found
- [x] `HEAD /api/projects/:projectId/buckets/:bucketName/files/:key` - should get file metadata
- [x] `HEAD /api/projects/:projectId/buckets/:bucketName/files/:key` - should return 404 if file not found
- [x] `DELETE /api/projects/:projectId/buckets/:bucketName/files/:key` - should delete file
- [x] `DELETE /api/projects/:projectId/buckets/:bucketName/files/:key` - should return 404 if file not found
- [x] `GET /api/projects/:projectId/buckets/:bucketName/files` - should list files
- [x] `GET /api/projects/:projectId/buckets/:bucketName/files` - should support prefix query param
- [x] `GET /api/projects/:projectId/buckets/:bucketName/files` - should support maxKeys query param

#### Chunked Uploads API Tests
- [x] `POST /api/projects/:projectId/buckets/:bucketName/files/:key/upload/initiate` - should initiate chunked upload
- [x] `POST /api/projects/:projectId/buckets/:bucketName/files/:key/upload/initiate` - should return 400 if total_size missing
- [x] `PUT /api/projects/:projectId/buckets/:bucketName/files/:key/upload/:uploadId/chunk/:chunkNumber` - should upload chunk
- [x] `PUT /api/projects/:projectId/buckets/:bucketName/files/:key/upload/:uploadId/chunk/:chunkNumber` - should return 400 if chunk missing
- [x] `POST /api/projects/:projectId/buckets/:bucketName/files/:key/upload/:uploadId/complete` - should complete chunked upload
- [x] `DELETE /api/projects/:projectId/buckets/:bucketName/files/:key/upload/:uploadId` - should abort chunked upload
- [x] `GET /api/projects/:projectId/buckets/:bucketName/files/:key/upload/:uploadId/status` - should get upload status
- [x] `GET /api/projects/:projectId/buckets/:bucketName/files/:key/upload/:uploadId/status` - should return 404 if upload not found

#### Signed URLs API Tests
- [x] `POST /api/projects/:projectId/buckets/:bucketName/files/:key/signed-url/upload` - should generate signed upload URL
- [x] `POST /api/projects/:projectId/buckets/:bucketName/files/:key/signed-url/download` - should generate signed download URL
- [x] `POST /api/projects/:projectId/buckets/:bucketName/files/:key/signed-url/download` - should return 404 if file not found
- [x] `GET /api/projects/:projectId/buckets/:bucketName/signed-urls` - should list signed URLs
- [x] `DELETE /api/signed-urls/:signedUrlId` - should revoke signed URL
- [x] `GET /signed/:signature/:fileId/:bucketId/:urlType` - should handle signed URL download
- [x] `GET /signed/:signature/:fileId/:bucketId/:urlType` - should return 403 for invalid signature
- [x] `GET /signed/:signature/:fileId/:bucketId/:urlType` - should return 403 for expired URL

#### Authentication Tests
- [x] All endpoints should return 401 without authentication token
- [x] All endpoints should accept valid service token
- [x] Service token validation should work with conductor

#### Error Handling Tests
- [x] Should return 404 for nonexistent project
- [x] Should return 404 for nonexistent bucket
- [x] Should return 404 for nonexistent file
- [x] Should return 409 for duplicate project
- [x] Should return 409 for duplicate bucket
- [x] Should return 409 when deleting project with buckets
- [x] Should return 409 when deleting bucket with files
- [x] Should return 400 for missing required fields
- [x] Should return 500 for internal server errors

### 6.3 End-to-End Tests

#### Full Storage Flow Tests
- [x] Complete workflow: create project → create bucket → upload file → download file → delete file → delete bucket → delete project
- [x] Multiple files in same bucket
- [x] Files with different content types
- [x] Files with special characters in key names
- [x] Files with nested paths (e.g., `folder/subfolder/file.txt`)

#### Encryption/Decryption Flow Tests
- [x] Upload encrypted file and download decrypted file
- [x] Verify encrypted file on disk is different from original
- [x] Verify decrypted file matches original content
- [x] Test with different encryption keys
- [x] Test with mocked key_manager
- [x] Test with real key_manager (when available)

#### Large File Upload Tests
- [x] Upload file via chunked upload (10MB+)
- [x] Upload multiple chunks in sequence
- [x] Complete chunked upload and verify file integrity
- [x] Abort chunked upload and verify cleanup
- [x] Get upload status during chunked upload
- [x] Handle chunk upload failures gracefully

#### Signed URL Tests
- [x] Generate signed upload URL and use it
- [x] Generate signed download URL and use it
- [x] Verify signed URL expires after TTL
- [x] Verify signed URL cannot be reused after use
- [x] Verify signed URL validation with invalid signature
- [x] List signed URLs for bucket
- [x] Revoke signed URL before expiration

#### Concurrent Access Tests
- [x] Multiple concurrent uploads to same bucket
- [x] Multiple concurrent downloads from same bucket
- [x] Concurrent chunked uploads
- [x] Concurrent signed URL generation
- [x] Race condition handling for file operations

#### Edge Cases Tests
- [x] Empty file upload
- [x] Very large file upload (100MB+)
- [x] File with maximum key length
- [x] File with special characters in key
- [x] File with unicode characters in key
- [x] Bucket with maximum number of files
- [x] Project with maximum number of buckets

#### Performance Tests
- [x] Upload performance for small files (< 1MB)
- [x] Upload performance for medium files (1-10MB)
- [x] Upload performance for large files (> 10MB)
- [x] Download performance for various file sizes
- [x] List performance for buckets with many files
- [x] Concurrent request handling performance

#### Database Tests
- [x] Database connection and initialization
- [x] Model creation and relationships
- [x] SQLite fallback when db_manager unavailable
- [x] Database migration and schema updates
- [x] Transaction handling
- [x] Database cleanup after tests

#### Service Registration Tests
- [x] Service registration with conductor
- [x] Service registration failure handling
- [x] Port auto-detection
- [x] Service token storage
- [x] Health check endpoint
- [x] Readiness check endpoint
- [x] Metrics endpoint

## Phase 7: Documentation

### 7.1 OpenAPI Specification
- [ ] Create `api/openapi.yaml` with full API documentation
- [ ] Include S3-compatible endpoints
- [ ] Include authentication requirements
- [ ] Include error responses
- [ ] Include multipart upload documentation

### 7.2 README
- [ ] Service overview
- [ ] Setup instructions
- [ ] Configuration guide
- [ ] S3 API compatibility notes
- [ ] Usage examples

## API Documentation (OpenAPI)

```yaml
openapi: 3.0.0
info:
  title: Storage Manager Service API (S3-Compatible)
  version: 1.0.0
  description: S3-compatible object storage service for aerekos-cloud

servers:
  - url: http://localhost:3003
    description: Local development
  - url: https://conductor.example.com/api/services/storage_manager
    description: Production (via conductor)

paths:
  /:
    get:
      summary: List all buckets
      tags: [Buckets]
      security:
        - ServiceToken: []
      responses:
        '200':
          description: List of buckets
          content:
            application/json:
              schema:
                type: object
                properties:
                  buckets:
                    type: array
                    items:
                      $ref: '#/components/schemas/Bucket'

  /{bucketName}:
    put:
      summary: Create a bucket
      tags: [Buckets]
      security:
        - ServiceToken: []
      parameters:
        - name: bucketName
          in: path
          required: true
          schema:
            type: string
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                encryption_enabled:
                  type: boolean
                  default: true
                encryption_key_name:
                  type: string
                  default: "storage-encryption-key"
                metadata:
                  type: object
      responses:
        '201':
          description: Bucket created
        '409':
          description: Bucket already exists
    
    get:
      summary: Get bucket details or list objects
      tags: [Buckets, Objects]
      security:
        - ServiceToken: []
      parameters:
        - name: bucketName
          in: path
          required: true
        - name: list-type
          in: query
          schema:
            type: string
            enum: [2]
            description: S3 ListObjectsV2
        - name: prefix
          in: query
          schema:
            type: string
        - name: max-keys
          in: query
          schema:
            type: integer
            default: 1000
      responses:
        '200':
          description: Bucket details or object list
        '404':
          description: Bucket not found
    
    delete:
      summary: Delete bucket
      tags: [Buckets]
      security:
        - ServiceToken: []
      responses:
        '204':
          description: Bucket deleted
        '409':
          description: Bucket not empty

  /{bucketName}/{key}:
    put:
      summary: Upload object
      tags: [Objects]
      security:
        - ServiceToken: []
      parameters:
        - name: bucketName
          in: path
          required: true
        - name: key
          in: path
          required: true
          description: Object key/path
      requestBody:
        content:
          application/octet-stream:
            schema:
              type: string
              format: binary
          multipart/form-data:
            schema:
              type: object
              properties:
                file:
                  type: string
                  format: binary
      responses:
        '200':
          description: Object uploaded
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Object'
    
    get:
      summary: Download object
      tags: [Objects]
      security:
        - ServiceToken: []
      parameters:
        - name: bucketName
          in: path
          required: true
        - name: key
          in: path
          required: true
      responses:
        '200':
          description: Object content
          content:
            application/octet-stream:
              schema:
                type: string
                format: binary
        '404':
          description: Object not found
    
    head:
      summary: Get object metadata
      tags: [Objects]
      security:
        - ServiceToken: []
      responses:
        '200':
          description: Object metadata
          headers:
            Content-Length:
              schema:
                type: integer
            Content-Type:
              schema:
                type: string
            ETag:
              schema:
                type: string
        '404':
          description: Object not found
    
    delete:
      summary: Delete object
      tags: [Objects]
      security:
        - ServiceToken: []
      responses:
        '204':
          description: Object deleted
        '404':
          description: Object not found

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
    Bucket:
      type: object
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
        encryption_enabled:
          type: boolean
        encryption_key_name:
          type: string
        created_at:
          type: string
          format: date-time
        metadata:
          type: object
    
    Object:
      type: object
      properties:
        id:
          type: string
          format: uuid
        bucket_name:
          type: string
        key:
          type: string
        size:
          type: integer
        content_type:
          type: string
        etag:
          type: string
        encrypted:
          type: boolean
        created_at:
          type: string
          format: date-time
        metadata:
          type: object

  securitySchemes:
    ServiceToken:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: Service-to-service token issued by conductor
```

## How Other Services Use storage_manager

**For agents implementing db_manager or other services that need object storage:**

### Uploading a File

```javascript
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function uploadFile(bucketName, key, filePath) {
  const conductorUrl = process.env.CONDUCTOR_URL;
  const serviceToken = process.env.SERVICE_TOKEN;
  
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  
  try {
    const response = await axios.put(
      `${conductorUrl}/api/services/storage_manager/${bucketName}/${key}`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${serviceToken}`
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );
    
    return response.data; // { etag, key, size, content_type }
  } catch (error) {
    throw new Error(`Failed to upload file: ${error.message}`);
  }
}
```

### Downloading a File

```javascript
async function downloadFile(bucketName, key, outputPath) {
  const conductorUrl = process.env.CONDUCTOR_URL;
  const serviceToken = process.env.SERVICE_TOKEN;
  
  try {
    const response = await axios.get(
      `${conductorUrl}/api/services/storage_manager/${bucketName}/${key}`,
      {
        headers: {
          'Authorization': `Bearer ${serviceToken}`
        },
        responseType: 'stream'
      }
    );
    
    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  } catch (error) {
    if (error.response?.status === 404) {
      throw new Error(`File '${key}' not found in bucket '${bucketName}'`);
    }
    throw new Error(`Failed to download file: ${error.message}`);
  }
}
```

### Creating a Bucket

```javascript
async function createBucket(bucketName, encryptionEnabled = true) {
  const response = await axios.put(
    `${conductorUrl}/api/services/storage_manager/${bucketName}`,
    {
      encryption_enabled: encryptionEnabled,
      encryption_key_name: 'storage-encryption-key'
    },
    {
      headers: {
        'Authorization': `Bearer ${serviceToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  return response.data;
}
```

### Listing Objects

```javascript
async function listObjects(bucketName, prefix = '') {
  const response = await axios.get(
    `${conductorUrl}/api/services/storage_manager/${bucketName}`,
    {
      params: {
        'list-type': 2,  // S3 ListObjectsV2
        prefix: prefix
      },
      headers: {
        'Authorization': `Bearer ${serviceToken}`
      }
    }
  );
  
  return response.data; // { keys: [...], total, ... }
}
```

## Dependencies

### External Services
- **Conductor**: Service registration, routing, authentication
- **key_manager**: Encryption keys for object encryption (REQUIRED - must be implemented first)
- **db_manager**: Database for metadata storage (can use SQLite fallback initially)

### Service Consumers
- **All services**: Object storage needs
- **db_manager**: Backup storage
- **api_manager**: File uploads

## Phase 8: Frontend Integration (Conductor UI)

### 8.1 Backend API Endpoints (Conductor)

**Goal**: Create conductor API endpoints to manage storage_manager service and proxy requests to it.

#### 8.1.1 Service Management Endpoints
- [ ] **POST /api/services/storage_manager/enable**
  - Enable storage_manager service
  - Deploy storage_manager container to available worker
  - Return deployment status
  - Request body: `{ worker_id?: string }` (optional - auto-select if not provided)

- [ ] **POST /api/services/storage_manager/disable**
  - Disable storage_manager service
  - Stop and remove storage_manager container
  - Return shutdown status

- [ ] **GET /api/services/storage_manager/status**
  - Get storage_manager service status
  - Return: `{ enabled: boolean, deployed: boolean, worker_id?: string, health?: object, stats?: object }`
  - Check if service is registered with conductor
  - Check if container is running
  - Get health status and storage stats from storage_manager if running

- [ ] **GET /api/services/storage_manager/instances**
  - Get all storage_manager instances across workers
  - Return: `{ instances: Array<{ worker_id, status, health, port, storage_stats }> }`

#### 8.1.2 Storage Manager Proxy Endpoints
- [ ] **Project Management**:
  - `GET /api/services/storage_manager/api/projects` - List all projects
  - `POST /api/services/storage_manager/api/projects` - Create project
  - `GET /api/services/storage_manager/api/projects/:projectId` - Get project details
  - `PUT /api/services/storage_manager/api/projects/:projectId` - Update project
  - `DELETE /api/services/storage_manager/api/projects/:projectId` - Delete project

- [ ] **Bucket Management**:
  - `GET /api/services/storage_manager/api/projects/:projectId/buckets` - List buckets
  - `POST /api/services/storage_manager/api/projects/:projectId/buckets` - Create bucket
  - `GET /api/services/storage_manager/api/projects/:projectId/buckets/:bucketName` - Get bucket details
  - `PUT /api/services/storage_manager/api/projects/:projectId/buckets/:bucketName` - Update bucket
  - `DELETE /api/services/storage_manager/api/projects/:projectId/buckets/:bucketName` - Delete bucket

- [ ] **File/Object Management**:
  - `GET /api/services/storage_manager/api/projects/:projectId/buckets/:bucketName/objects` - List objects (S3-compatible)
  - `POST /api/services/storage_manager/api/projects/:projectId/buckets/:bucketName/objects` - Upload object
  - `GET /api/services/storage_manager/api/projects/:projectId/buckets/:bucketName/objects/:key` - Download object
  - `DELETE /api/services/storage_manager/api/projects/:projectId/buckets/:bucketName/objects/:key` - Delete object
  - `GET /api/services/storage_manager/api/projects/:projectId/buckets/:bucketName/objects/:key/metadata` - Get object metadata
  - `POST /api/services/storage_manager/api/projects/:projectId/buckets/:bucketName/objects/copy` - Copy object

- [ ] **Chunked Upload**:
  - `POST /api/services/storage_manager/api/projects/:projectId/buckets/:bucketName/uploads` - Initiate chunked upload
  - `PUT /api/services/storage_manager/api/projects/:projectId/buckets/:bucketName/uploads/:uploadId/chunks/:chunkNumber` - Upload chunk
  - `POST /api/services/storage_manager/api/projects/:projectId/buckets/:bucketName/uploads/:uploadId/complete` - Complete upload
  - `DELETE /api/services/storage_manager/api/projects/:projectId/buckets/:bucketName/uploads/:uploadId` - Abort upload
  - `GET /api/services/storage_manager/api/projects/:projectId/buckets/:bucketName/uploads/:uploadId` - Get upload status

- [ ] **Signed URLs**:
  - `POST /api/services/storage_manager/api/projects/:projectId/buckets/:bucketName/signed-urls/upload` - Generate signed upload URL
  - `POST /api/services/storage_manager/api/projects/:projectId/buckets/:bucketName/signed-urls/download` - Generate signed download URL
  - `GET /api/services/storage_manager/api/projects/:projectId/buckets/:bucketName/signed-urls` - List signed URLs
  - `DELETE /api/services/storage_manager/api/projects/:projectId/buckets/:bucketName/signed-urls/:urlId` - Revoke signed URL

- [ ] **Health & Metrics**:
  - `GET /api/services/storage_manager/health` - Proxy health check
  - `GET /api/services/storage_manager/metrics` - Proxy metrics endpoint

#### 8.1.3 Implementation Details
- [ ] Extend `conductor/api/services/ServiceManager.js`:
  - Add storage_manager-specific methods
  - Handle file upload/download proxying (stream handling)
  - Handle chunked upload proxying
  - Handle signed URL generation

- [ ] Create `conductor/api/routes/storageManager.js`:
  - Service management routes
  - Service proxy routes
  - File upload/download stream handling
  - Error handling for service unavailable

- [ ] Add service discovery:
  - Find storage_manager instances via conductor service registry
  - Load balance requests across multiple instances
  - Handle service unavailable gracefully

- [ ] Add authentication middleware:
  - All routes require user authentication
  - Service-to-service requests use service tokens
  - File upload/download may need special handling

### 8.2 Frontend Service Management Screen

**Goal**: Create a storage manager management screen similar to AWS S3 console.

#### 8.2.1 Storage Manager Service Screen
- [x] Create `conductor/app/screens/StorageManager/StorageManager.jsx`: ✅ COMPLETE
  - Service status display (enabled/disabled, health status)
  - Enable/Disable toggle button
  - Service health indicator (green/yellow/red)
  - Worker deployment info (which worker is running it)
  - Storage statistics display:
    - Total projects count
    - Total buckets count
    - Total files count
    - Total storage used (GB/TB)
    - Storage by project breakdown
  - Navigation to storage management UI

- [x] Create `conductor/app/screens/StorageManager/StorageManager.styles.js`: ✅ COMPLETE
  - Assassin's Creed-inspired dark theme
  - Service status cards
  - Toggle button styling
  - Statistics display styling

- [x] Add service management API calls: ✅ COMPLETE
  - `storageManagerService.enable()` - Enable service
  - `storageManagerService.disable()` - Disable service
  - `storageManagerService.getStatus()` - Get status
  - `storageManagerService.getStats()` - Get storage statistics

- [x] Create `conductor/app/services/storageManagerService.js`: ✅ COMPLETE
  ```javascript
  export const storageManagerService = {
    async enable(workerId) {
      // POST /api/services/storage_manager/enable
    },
    async disable() {
      // POST /api/services/storage_manager/disable
    },
    async getStatus() {
      // GET /api/services/storage_manager/status
    },
    async getStats() {
      // GET /api/services/storage_manager/metrics
    },
    // Project management methods (proxied)
    async getProjects() {
      // GET /api/services/storage_manager/api/projects
    },
    async createProject(projectData) {
      // POST /api/services/storage_manager/api/projects
    },
    // ... etc
  };
  ```

### 8.3 Project Management UI

**Goal**: Create UI for managing projects (top-level organization).

#### 8.3.1 Projects List Screen
- [x] Create `conductor/app/screens/StorageManager/ProjectsList.jsx`: ✅ COMPLETE
  - List of all projects
  - Project cards showing:
    - Project name
    - Bucket count
    - File count
    - Storage used
    - Created date
  - "Create Project" button
  - Search/filter projects
  - Sort by name, created date, storage used
  - Click project to navigate to buckets

- [x] Create `conductor/app/screens/StorageManager/ProjectsList.styles.js`: ✅ COMPLETE
  - Project card grid/list styling
  - Search/filter controls styling

#### 8.3.2 Project Details Screen
- [ ] Create `conductor/app/screens/StorageManager/ProjectDetails.jsx`:
  - Project information display
  - Buckets list (navigate to bucket)
  - Storage statistics for project
  - Actions:
    - Edit project (metadata)
    - Delete project (with confirmation)
    - Create bucket button
  - Navigation breadcrumb: Projects → [Project Name]

- [ ] Create `conductor/app/screens/StorageManager/ProjectDetails.styles.js`:
  - Project info card styling
  - Buckets list styling

#### 8.3.3 Create/Edit Project Screen
- [ ] Create `conductor/app/screens/StorageManager/CreateProject.jsx`:
  - Form fields:
    - Project Name (required, unique)
    - Description (optional)
    - Metadata (JSON editor, optional)
  - Form validation
  - Submit/Cancel buttons

### 8.4 Bucket Management UI

**Goal**: Create UI for managing buckets within projects.

#### 8.4.1 Buckets List Screen
- [x] Create `conductor/app/screens/StorageManager/BucketsList.jsx`: ✅ COMPLETE
  - List of buckets in project
  - Bucket cards showing:
    - Bucket name
    - File count
    - Storage used
    - Encryption status (enabled/disabled)
    - Created date
  - "Create Bucket" button
  - Search/filter buckets
  - Click bucket to navigate to files

- [x] Create `conductor/app/screens/StorageManager/BucketsList.styles.js`: ✅ COMPLETE
  - Bucket card styling

#### 8.4.2 Bucket Details Screen
- [x] Create `conductor/app/screens/StorageManager/BucketDetails.jsx`: ✅ COMPLETE
  - Bucket information display
  - Encryption settings:
    - Encryption enabled/disabled toggle
    - Encryption key selection (from key_manager)
  - Storage statistics
  - File browser with upload/download functionality
  - Actions:
    - Edit bucket settings
    - Delete bucket (with confirmation - must be empty)
  - Navigation breadcrumb: Projects → [Project] → [Bucket]

#### 8.4.3 Create/Edit Bucket Screen
- [ ] Create `conductor/app/screens/StorageManager/CreateBucket.jsx`:
  - Form fields:
    - Bucket Name (required, unique within project)
    - Encryption enabled (checkbox)
    - Encryption key name (dropdown from key_manager)
    - Metadata (JSON editor, optional)
  - Form validation
  - Submit/Cancel buttons

### 8.5 File/Object Browser UI

**Goal**: Create an interactive file browser similar to AWS S3 console.

#### 8.5.1 File Browser Screen
- [ ] Create `conductor/app/screens/StorageManager/FileBrowser.jsx`:
  - File list/table showing:
    - File name/key
    - Size
    - Type/MIME type
    - Last modified date
    - Encryption status
    - Actions (download, delete, copy, view metadata)
  - Folder/prefix navigation (S3-style)
  - Breadcrumb navigation (prefix path)
  - Search/filter files by name/prefix
  - Sort by name, size, date
  - Pagination (for large buckets)
  - Upload button (opens upload modal)
  - Bulk selection (select multiple files)
  - Bulk actions (delete, copy, download)

- [ ] Create `conductor/app/screens/StorageManager/FileBrowser.styles.js`:
  - File table styling
  - Folder/prefix navigation styling
  - Breadcrumb styling

#### 8.5.2 File Upload UI
- [ ] Create `conductor/app/components/FileUpload/FileUpload.jsx`:
  - Drag-and-drop file upload area
  - File selection button
  - Upload progress display:
    - File name
    - Upload progress (percentage, speed, ETA)
    - Cancel button
  - Multiple file upload support
  - Chunked upload support (for large files):
    - Show chunk progress
    - Show overall progress
    - Pause/resume functionality
  - Upload queue management
  - Success/error notifications

- [ ] Create `conductor/app/components/FileUpload/FileUpload.styles.js`:
  - Drag-and-drop area styling
  - Progress bar styling
  - Upload queue styling

#### 8.5.3 File Details/Preview Screen
- [x] Create `conductor/app/screens/StorageManager/FileDetails.jsx`: ✅ COMPLETE
  - File information display:
    - File name/key
    - Size
    - MIME type
    - Last modified
    - Encryption key used
    - ETag/checksum
    - Metadata (JSON display)
  - File preview (if supported):
    - Images: Image preview
    - Text files: Text preview
    - PDFs: PDF viewer (if available)
    - Videos: Video player (if available)
  - Actions:
    - Download file
    - Copy file (to another bucket/key)
    - Delete file
    - Generate signed URL
    - View metadata
  - Navigation breadcrumb: Projects → [Project] → [Bucket] → [File]

#### 8.5.4 File Download UI
- [ ] Create download functionality:
  - Direct download button
  - Generate signed URL option
  - Download with custom filename
  - Download progress indicator
  - Handle large file downloads (streaming)

### 8.6 Signed URL Management UI

**Goal**: Create UI for managing signed URLs.

#### 8.6.1 Signed URLs List Screen
- [ ] Create `conductor/app/screens/StorageManager/SignedUrlsList.jsx`:
  - List of active signed URLs
  - Display:
    - URL (masked/truncated)
    - Type (upload/download)
    - Expiration date/time
    - File/bucket it's for
    - Status (active/expired)
  - Actions:
    - Copy URL to clipboard
    - Revoke URL
    - View full URL (with warning)
  - Filter by type, status
  - Sort by expiration date

#### 8.6.2 Generate Signed URL Screen
- [ ] Create `conductor/app/screens/StorageManager/GenerateSignedUrl.jsx`:
  - Form fields:
    - Project selection
    - Bucket selection
    - File key (for download) or new key (for upload)
    - URL type (upload/download)
    - TTL (time to live in seconds/hours/days)
    - Expiration date/time picker
  - Generate button
  - Display generated URL (with copy button)
  - QR code generation (for easy sharing)

### 8.7 Chunked Upload UI

**Goal**: Create UI for managing large file chunked uploads.

#### 8.7.1 Chunked Upload Manager
- [ ] Create `conductor/app/components/ChunkedUpload/ChunkedUpload.jsx`:
  - Upload progress display:
    - Overall progress
    - Individual chunk progress
    - Upload speed
    - ETA
  - Pause/Resume controls
  - Cancel upload button
  - Retry failed chunks
  - Upload queue (multiple files)

#### 8.7.2 Upload History
- [ ] Create `conductor/app/screens/StorageManager/UploadHistory.jsx`:
  - List of chunked uploads (active and completed)
  - Show upload status (in progress, completed, failed, aborted)
  - Resume failed uploads
  - Clear completed uploads

### 8.8 Reusable Components

- [ ] Create `conductor/app/components/ProjectCard/ProjectCard.jsx`:
  - Reusable project card component
  - Display project summary
  - Click to navigate to project details

- [ ] Create `conductor/app/components/BucketCard/BucketCard.jsx`:
  - Reusable bucket card component
  - Display bucket summary
  - Click to navigate to bucket files

- [ ] Create `conductor/app/components/FileRow/FileRow.jsx`:
  - Reusable file row component for file browser
  - Display file info
  - Action buttons (download, delete, etc.)
  - Selection checkbox

- [ ] Create `conductor/app/components/StorageStats/StorageStats.jsx`:
  - Storage statistics display component
  - Show total storage, by project, by bucket
  - Visual charts/graphs (optional)

- [ ] Create `conductor/app/components/Breadcrumb/Breadcrumb.jsx`:
  - Navigation breadcrumb component
  - Projects → Project → Bucket → File path

- [ ] Create `conductor/app/components/FilePreview/FilePreview.jsx`:
  - File preview component
  - Support for images, text, PDFs, videos
  - Fallback for unsupported types

### 8.9 Navigation Integration

- [x] Add Storage Manager to Dashboard: ✅ COMPLETE
  - Add "Storage Manager" card/section
  - Show service status
  - Show storage statistics summary
  - Link to Storage Manager screen

- [x] Add Storage Manager to navigation: ✅ COMPLETE
  - Add route: `/storage-manager` → Storage Manager service screen
  - Add route: `/storage-manager/projects` → Projects list screen
  - Add route: `/storage-manager/projects/:projectId` → Project details screen
  - Add route: `/storage-manager/projects/:projectId/buckets` → Buckets list screen
  - Add route: `/storage-manager/projects/:projectId/buckets/:bucketName` → Bucket details screen
  - Add route: `/storage-manager/projects/:projectId/buckets/:bucketName/files` → File browser screen
  - Add route: `/storage-manager/projects/:projectId/buckets/:bucketName/files/:key` → File details screen
  - Add route: `/storage-manager/signed-urls` → Signed URLs list screen

- [x] Update App.js routing: ✅ COMPLETE
  - Add storage manager routes
  - Add navigation handlers

- [x] Update Header component: ✅ COMPLETE
  - Add Storage Manager icon/link (optional)
  - Or add to Services menu

### 8.10 Real-time Updates

- [ ] WebSocket integration:
  - Listen for storage_manager service status changes
  - Listen for file upload progress updates
  - Listen for storage statistics updates
  - Update UI in real-time

- [ ] Polling fallback:
  - Poll service status every 30 seconds
  - Poll file list every 60 seconds (if on file browser)
  - Poll upload progress every 2 seconds (if uploading)

### 8.11 Error Handling & UX

- [ ] Error states:
  - Service unavailable (show error message, retry button)
  - Network errors (show error, retry)
  - Upload errors (show error, retry upload)
  - Validation errors (show inline form errors)
  - Permission errors (show message, redirect if needed)
  - File too large errors
  - Storage quota exceeded errors

- [ ] Loading states:
  - Loading spinner for async operations
  - Skeleton screens for data loading
  - Upload progress indicators
  - Disable buttons during operations

- [ ] Success feedback:
  - Toast notifications for success actions
  - Success messages on forms
  - Auto-refresh after successful operations
  - Upload completion notifications

- [ ] Empty states:
  - No projects message with "Create Project" button
  - No buckets message with "Create Bucket" button
  - No files message with "Upload File" button
  - Service disabled message with "Enable Service" button

### 8.12 Security Considerations

- [ ] File upload security:
  - File type validation
  - File size limits
  - Virus scanning (future enhancement)
  - Rate limiting

- [ ] Access control:
  - All API calls require user authentication
  - Check user permissions (admin only for service management?)
  - Validate all inputs on frontend and backend

- [ ] Signed URL security:
  - Show warnings about URL expiration
  - Mask URLs in UI (show only when needed)
  - Revoke URLs easily

- [ ] Encryption indicators:
  - Show encryption status clearly
  - Warn when encryption is disabled
  - Show which encryption key is used

### 8.13 Performance Optimizations

- [ ] Large file handling:
  - Chunked upload for files >100MB
  - Progress indicators
  - Pause/resume functionality
  - Background upload queue

- [ ] List pagination:
  - Paginate large file lists
  - Virtual scrolling for very large lists
  - Lazy loading

- [ ] Caching:
  - Cache project/bucket lists
  - Cache file metadata
  - Invalidate cache on updates

### 8.14 Testing

- [ ] Frontend unit tests:
  - Test StorageManager screen components
  - Test project/bucket/file list rendering
  - Test file upload component
  - Test form validation
  - Test service toggle functionality

- [ ] Integration tests:
  - Test service enable/disable flow
  - Test project CRUD operations
  - Test bucket CRUD operations
  - Test file upload/download flow
  - Test chunked upload flow
  - Test signed URL generation
  - Test error handling

- [ ] E2E tests:
  - Test complete storage workflow
  - Test service management workflow
  - Test file upload/download workflow

### 8.15 Implementation Checklist

**Backend (Conductor)**:
- [ ] Extend ServiceManager service for storage_manager
- [ ] Create storage manager routes
- [ ] Create service proxy routes (including file streaming)
- [ ] Add service discovery
- [ ] Add authentication middleware
- [ ] Handle file upload/download streaming
- [ ] Handle chunked upload proxying
- [ ] Test all endpoints

**Frontend**:
- [ ] Create StorageManager service screen
- [ ] Create service status component
- [ ] Create service toggle component
- [ ] Create projects list screen
- [ ] Create project details screen
- [ ] Create buckets list screen
- [ ] Create bucket details screen
- [ ] Create file browser screen
- [ ] Create file upload component
- [ ] Create file details/preview screen
- [ ] Create signed URLs management screens
- [ ] Create chunked upload components
- [ ] Create reusable components (ProjectCard, BucketCard, FileRow, etc.)
- [ ] Add navigation routes
- [ ] Add error handling
- [ ] Add loading states
- [ ] Add real-time updates
- [ ] Test all screens

**Documentation**:
- [ ] Update README with frontend usage
- [ ] Document API endpoints
- [ ] Create user guide for storage management
- [ ] Document file upload/download workflows

## Next Steps

After completing this plan:
1. Test integration with key_manager
2. Test integration with db_manager
3. Implement enterprise features (backup, disaster recovery)
4. Performance optimization for large files
5. **Implement frontend integration (Phase 8)** - Storage Manager UI in conductor

