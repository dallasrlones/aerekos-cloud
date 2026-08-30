# Key Manager Service (KMS) Implementation Plan

## ✅ STATUS: BACKEND COMPLETE | FRONTEND MOSTLY COMPLETE

**Backend Status**: ✅ Complete
- Phases 1-7: All backend implementation complete
- Test Status: ✅ Comprehensive test suite implemented
  - Unit tests: 5 test files covering all core functionality
  - Integration tests: 3 test files covering API endpoints and workflows
  - Test cases documented in Phase 6 section below

**Frontend Status**: ✅ Mostly Complete (Phase 8)
- ✅ Service management screen implemented (KeyManager.jsx)
- ✅ Key list screen implemented (KeysList.jsx)
- ✅ Key details screen implemented (KeyDetails.jsx)
- ✅ Create key screen implemented (CreateKey.jsx)
- ✅ KeyCard component implemented
- ✅ KeyMaterial component implemented
- ✅ Archive functionality implemented (delete removed per security best practices)
- ✅ Navigation integration complete
- ⏳ Some Phase 8 items may still need completion (see Phase 8 checklist below)

**Priority**: HIGH - Foundation service for encryption across the platform

## Quick Start for Agents

**IMPLEMENT THIS SERVICE FIRST** - Other services depend on it.

**Can be implemented in parallel with**: storage_manager and db_manager (storage_manager will stub key_manager calls during development)

**Dependencies**:
- ✅ Conductor (must be running)
- ✅ SQLite (built-in, no external service needed)

**Key Implementation Points**:
1. USB flash drive master key loading (entrypoint script)
2. Key encryption/decryption with master key
3. Service registration with conductor
4. API endpoints for key CRUD operations

**See "How Other Services Use key_manager" section below for integration examples.**

## Overview

Key Manager Service (KMS) provides enterprise-grade key management for encryption across aerekos-cloud. It manages encryption keys, handles key rotation, and provides secure key storage with master key encryption from USB flash drive.

**Follow**: [../../plan.md](../../plan.md) for high-level roadmap and architecture overview.

## Architecture

### Key Features
- **Master Key Encryption**: Keys encrypted with master key from USB flash drive
- **Key Lifecycle Management**: Create, rotate, archive, delete keys
- **Key Versioning**: Support multiple versions of keys for rotation
- **Access Control**: Service-to-service authentication via conductor tokens
- **High Availability**: Can be deployed across multiple workers
- **Enterprise Features**: Health checks, metrics, audit logging

### Service Dependencies
- **Conductor**: Service registration, routing, authentication
- **db_manager**: Creates/manages SQLite database for key storage
- **USB Flash Drive**: Provides master key for encryption (production)

### Service Consumers
- **storage_manager**: Requests encryption keys for object encryption
- **All services**: Can request keys for encrypting sensitive data

## Implementation Order

**This service should be implemented FIRST** before storage_manager and db_manager, as they depend on it.

## Phase 1: Initial Setup & Configuration

### 1.1 Project Structure
- [ ] Create folder structure:
  ```
  key_manager/
  ├── api/
  │   ├── routes/
  │   │   └── keys.js
  │   ├── services/
  │   │   └── KeyService.js
  │   ├── repos/
  │   │   └── KeyRepository.js
  │   ├── middleware/
  │   │   ├── auth.js
  │   │   └── errorHandler.js
  │   ├── utils/
  │   │   ├── encryption.js
  │   │   ├── serviceRegistration.js
  │   │   └── portDetection.js
  │   └── models/
  │       └── index.js
  ├── scripts/
  │   └── docker-entrypoint.sh
  ├── data/              # SQLite database (gitignored)
  ├── tests/
  │   ├── unit/
  │   ├── integration/
  │   └── helpers/
  ├── .env_example
  ├── .env              # gitignored
  ├── .gitignore
  ├── Dockerfile
  ├── Dockerfile.dev
  ├── docker-compose.yml
  ├── package.json
  ├── plan.md
  ├── README.md
  └── api/
      └── openapi.yaml
  ```

### 1.2 Environment Configuration
- [ ] Create `.env_example` file with all required variables:
  ```bash
  # Service Identity
  SERVICE_NAME=key_manager
  SERVICE_VERSION=1.0.0
  PORT=3002

  # Conductor Connection
  CONDUCTOR_URL=http://conductor:3000
  SERVICE_TOKEN=  # Will be obtained during registration

  # Master Key (from USB flash drive)
  MASTER_KEY=  # Set by docker-entrypoint.sh from USB
  MASTER_KEY_FILE=/mnt/usb/master.key

  # Database (SQLite for key_manager - small and local)
  DATABASE_PATH=/app/data/key_manager.db

  # Logging
  LOG_LEVEL=info
  NODE_ENV=development
  ```
- [ ] Create `.env` file (gitignored) for actual configuration
- [ ] Document each variable in comments

### 1.3 Package Dependencies
- [ ] Create `package.json` with:
  - `express` - Web framework
  - `dotenv` - Environment variables
  - `crypto` - Built-in Node.js crypto (for encryption)
  - `axios` - HTTP client for conductor/db_manager calls
  - `uuid` - UUID generation for keys
  - `joi` - Input validation
  - `winston` - Structured logging
  - **`aerekos-record`** - **REQUIRED**: ORM for all database models (must be installed)
  - `jest` - Testing framework
  - `supertest` - API testing

**Note**: aerekos-record is located at `../../services/aerekos-record` in the worker directory. You can either:
- Copy it to each service's `node_modules`, OR
- Use a symlink, OR
- Reference it directly: `const Record = require('../../services/aerekos-record')`

### 1.4 Docker Setup
- [ ] Create `Dockerfile` (production):
  ```dockerfile
  FROM node:18-alpine
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci --only=production
  COPY . .
  EXPOSE ${PORT:-3002}
  CMD ["node", "index.js"]
  ```
- [ ] Create `Dockerfile.dev` (development with nodemon):
  ```dockerfile
  FROM node:18-alpine
  WORKDIR /app
  COPY package*.json ./
  RUN npm install
  COPY . .
  EXPOSE ${PORT:-3002}
  CMD ["npm", "run", "dev"]
  ```
- [ ] Create `docker-compose.yml`:
  ```yaml
  services:
    key_manager:
      build:
        context: .
        dockerfile: Dockerfile.dev
      container_name: key-manager
      ports:
        - "${PORT:-3002}:${PORT:-3002}"
      volumes:
        - ./data:/app/data
        - ./api:/app/api
        - ./index.js:/app/index.js
        - /dev:/dev  # Access to USB devices
      devices:
        - /dev/sdX1:/dev/usb:ro  # USB device (adjust device name)
      env_file:
        - .env
      environment:
        - NODE_ENV=development
      restart: unless-stopped
      healthcheck:
        test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "-O", "-", "http://localhost:${PORT:-3002}/health"]
        interval: 10s
        timeout: 5s
        retries: 5
      networks:
        - aerekos-cloud-network
  networks:
    aerekos-cloud-network:
      external: true
  ```
- [ ] Create `scripts/docker-entrypoint.sh`:
  ```bash
  #!/bin/sh
  set -e
  
  echo "[key_manager] Starting key manager service..."
  
  # USB Flash Drive Detection and Master Key Loading
  USB_DEVICE="/dev/usb"  # Mounted USB device
  MASTER_KEY_FILE="/mnt/usb/master.key"
  
  if [ -b "$USB_DEVICE" ] || [ -d "$USB_DEVICE" ]; then
    echo "[key_manager] USB device detected, attempting to read master key..."
    
    # Try to mount USB (if not already mounted)
    if [ ! -d "/mnt/usb" ]; then
      mkdir -p /mnt/usb
      mount "$USB_DEVICE" /mnt/usb 2>/dev/null || echo "[key_manager] USB already mounted or mount failed"
    fi
    
    # Read master key file
    if [ -f "$MASTER_KEY_FILE" ]; then
      MASTER_KEY=$(cat "$MASTER_KEY_FILE" | tr -d '\n\r ')
      export MASTER_KEY
      echo "[key_manager] Master key loaded from USB"
      
      # Unmount USB for security
      umount /mnt/usb 2>/dev/null || true
    else
      echo "[key_manager] WARNING: master.key file not found on USB"
      if [ -z "$MASTER_KEY" ]; then
        echo "[key_manager] ERROR: MASTER_KEY not set and USB file not found"
        exit 1
      fi
    fi
  else
    echo "[key_manager] No USB device detected, using MASTER_KEY from environment (dev mode)"
    if [ -z "$MASTER_KEY" ]; then
      echo "[key_manager] WARNING: MASTER_KEY not set - using default for development only"
      export MASTER_KEY="dev-master-key-change-in-production"
    fi
  fi
  
  # Auto-detect port if needed
  if [ -z "$PORT" ]; then
    PORT=$(node -e "const net = require('net'); const server = net.createServer(); server.listen(0, () => { console.log(server.address().port); server.close(); });")
    export PORT
  fi
  
  # Start service
  exec node index.js
  ```
- [ ] Make entrypoint script executable: `chmod +x scripts/docker-entrypoint.sh`

## Phase 2: Database Setup

### 2.1 Database Creation via db_manager

**IMPORTANT**: This service uses db_manager to create its database. Since db_manager may not exist yet, you have two options:
1. **Option A (Recommended)**: Use SQLite directly for key_manager (it's small and local)
2. **Option B**: Wait for db_manager, then use it to create the database

For initial implementation, use SQLite directly**:

- [ ] Create `api/utils/dbClient.js`:
  ```javascript
  const path = require('path');
  const fs = require('fs');
  const Record = require('../../services/aerekos-record');
  
  // For key_manager, we use SQLite directly (small, local database)
  // Other services will use db_manager to create databases
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/key_manager.db');
  
  // Ensure data directory exists
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  const db = Record.connect('sqlite', {
    database: dbPath
  });
  
  module.exports = db;
  ```

**Future enhancement**: After db_manager is implemented, you can optionally migrate to using db_manager:
- [ ] Create `api/utils/dbManagerClient.js`:
  ```javascript
  const axios = require('axios');
  
  async function createDatabaseViaDbManager() {
    const conductorUrl = process.env.CONDUCTOR_URL;
    const serviceToken = process.env.SERVICE_TOKEN;
    
    try {
      const response = await axios.post(
        `${conductorUrl}/api/services/db_manager/databases`,
        {
          name: 'key_manager',
          type: 'sqlite',  // or 'postgresql' for production
          metadata: {
            service: 'key_manager',
            description: 'Key Manager Service Database'
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${serviceToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('[key_manager] Database creation via db_manager failed:', error.message);
      throw error;
    }
  }
  
  module.exports = { createDatabaseViaDbManager };
  ```

### 2.2 Database Models (using aerekos-record)

**CRITICAL**: All models MUST use aerekos-record. Never use raw SQL or other ORMs.

- [ ] Create `api/models/index.js`:
  ```javascript
  const db = require('../utils/dbClient');
  
  // Key Model
  // Note: SQLite doesn't support boolean, so we use integer (0 = false, 1 = true)
  const Key = db.model('Key', {
    name: 'string',
    type: 'string',  // 'symmetric', 'asymmetric', 'master'
    algorithm: 'string',  // 'AES-256-GCM', 'RSA-4096', etc.
    encrypted_key: 'string',  // Encrypted key material (encrypted with master key)
    key_version: 'number',
    is_active: 'number',  // 0 = false, 1 = true (SQLite boolean workaround)
    rotated_at: 'datetime',
    metadata: 'string'  // JSON string for additional metadata
  }, {
    required: ['name', 'type', 'algorithm', 'encrypted_key'],
    unique: ['name'],
    timestamps: true  // Automatically adds created_at and updated_at
  });
  
  // KeyAccess Model (audit log)
  const KeyAccess = db.model('KeyAccess', {
    service_name: 'string',
    action: 'string',  // 'get', 'rotate', 'delete'
    timestamp: 'datetime',
    ip_address: 'string',
    success: 'number'  // 0 = false, 1 = true
  }, {
    required: ['service_name', 'action', 'timestamp'],
    belongsTo: ['Key'],  // Creates key_id foreign key
    timestamps: false  // We use timestamp field instead
  });
  
  module.exports = {
    Key,
    KeyAccess,
    db
  };
  ```

**Model Usage Examples**:
```javascript
const { Key, KeyAccess } = require('../models');

// Create a key
const key = await Key.create({
  name: 'storage-encryption-key',
  type: 'symmetric',
  algorithm: 'AES-256-GCM',
  encrypted_key: 'encrypted-key-material',
  key_version: 1,
  is_active: 1,
  metadata: JSON.stringify({ description: 'Key for storage encryption' })
});

// Find key by name
const foundKey = await Key.findAll({ where: { name: 'storage-encryption-key' } });

// Update key
await Key.update(key.id, { is_active: 0 });

// Log key access
await KeyAccess.create({
  key_id: key.id,
  service_name: 'storage_manager',
  action: 'get',
  timestamp: new Date().toISOString(),
  ip_address: '127.0.0.1',
  success: 1
});
```

### 2.3 Database Initialization
- [ ] Create database initialization script
- [ ] Create tables on first startup
- [ ] Create default master key if none exists (development only)

## Phase 3: Core Key Management

### 3.1 Key Service

**TASK**: Create the core business logic for key management. This is the heart of the service.

- [ ] Create `api/services/KeyService.js`:
  ```javascript
  const crypto = require('crypto');
  const KeyRepository = require('../repos/KeyRepository');
  
  class KeyService {
    constructor(keyRepository, masterKey) {
      this.keyRepository = keyRepository;
      this.masterKey = masterKey; // From environment (set by entrypoint script)
      
      if (!this.masterKey) {
        throw new Error('MASTER_KEY not set - cannot initialize KeyService');
      }
    }
    
    /**
     * Create a new encryption key
     * @param {string} name - Unique key identifier
     * @param {string} type - Key type: 'symmetric', 'asymmetric', 'master'
     * @param {string} algorithm - Algorithm: 'AES-256-GCM', 'RSA-4096', etc.
     * @param {object} metadata - Additional metadata
     * @returns {Promise<object>} Created key
     */
    async createKey(name, type, algorithm, metadata = {}) {
      // Validate inputs
      if (!name || !type || !algorithm) {
        throw new Error('name, type, and algorithm are required');
      }
      
      // Check if key already exists
      const existing = await this.keyRepository.findByName(name);
      if (existing) {
        throw new Error(`Key '${name}' already exists`);
      }
      
      // Generate key material based on type
      let keyMaterial;
      if (type === 'symmetric') {
        // Generate random symmetric key
        keyMaterial = crypto.randomBytes(32).toString('hex'); // 256 bits
      } else if (type === 'asymmetric') {
        // Generate RSA key pair
        const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
          modulusLength: algorithm.includes('4096') ? 4096 : 2048,
          publicKeyEncoding: { type: 'spki', format: 'pem' },
          privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
        });
        keyMaterial = JSON.stringify({ publicKey, privateKey });
      } else {
        throw new Error(`Unsupported key type: ${type}`);
      }
      
      // Encrypt key material with master key
      const encryptedKey = this.encryptKey(keyMaterial);
      
      // Create key record
      const key = await this.keyRepository.create({
        name,
        type,
        algorithm,
        encrypted_key: encryptedKey,
        key_version: 1,
        is_active: true,
        metadata: JSON.stringify(metadata)
      });
      
      return this.formatKeyResponse(key);
    }
    
    /**
     * Get key by name (latest version)
     * @param {string} name - Key name
     * @param {number} version - Optional specific version
     * @returns {Promise<object>} Key with decrypted key material
     */
    async getKey(name, version = null) {
      let key;
      
      if (version) {
        key = await this.keyRepository.findByNameAndVersion(name, version);
      } else {
        key = await this.keyRepository.findByName(name);
      }
      
      if (!key) {
        throw new Error(`Key '${name}' not found`);
      }
      
      // Decrypt key material
      const decryptedKeyMaterial = this.decryptKey(key.encrypted_key);
      
      return {
        ...this.formatKeyResponse(key),
        key_material: decryptedKeyMaterial  // Include decrypted material for service use
      };
    }
    
    /**
     * List all keys with optional filtering
     * @param {object} filter - Filter options
     * @returns {Promise<Array>} List of keys
     */
    async listKeys(filter = {}) {
      const keys = await this.keyRepository.findAll(filter);
      return keys.map(key => this.formatKeyResponse(key));
    }
    
    /**
     * Rotate a key (create new version)
     * @param {string} name - Key name
     * @returns {Promise<object>} New key version
     */
    async rotateKey(name) {
      const currentKey = await this.keyRepository.findByName(name);
      if (!currentKey) {
        throw new Error(`Key '${name}' not found`);
      }
      
      // Generate new key material
      const keyMaterial = crypto.randomBytes(32).toString('hex');
      const encryptedKey = this.encryptKey(keyMaterial);
      
      // Mark old version as inactive
      await this.keyRepository.update(currentKey.id, { is_active: false });
      
      // Create new version
      const newKey = await this.keyRepository.create({
        name,
        type: currentKey.type,
        algorithm: currentKey.algorithm,
        encrypted_key: encryptedKey,
        key_version: currentKey.key_version + 1,
        is_active: true,
        metadata: currentKey.metadata,
        rotated_at: new Date().toISOString()
      });
      
      return this.formatKeyResponse(newKey);
    }
    
    /**
     * Encrypt key material with master key
     * @param {string} keyMaterial - Key material to encrypt
     * @returns {string} Encrypted key (hex string)
     */
    encryptKey(keyMaterial) {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(this.masterKey, 'hex'), iv);
      
      let encrypted = cipher.update(keyMaterial, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();
      
      // Return IV + authTag + encrypted data (all hex)
      return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    }
    
    /**
     * Decrypt key material with master key
     * @param {string} encryptedKey - Encrypted key string
     * @returns {string} Decrypted key material
     */
    decryptKey(encryptedKey) {
      const [ivHex, authTagHex, encrypted] = encryptedKey.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      
      const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(this.masterKey, 'hex'), iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    }
    
    /**
     * Format key response (without sensitive data)
     * @param {object} key - Key record
     * @returns {object} Formatted key response
     */
    formatKeyResponse(key) {
      return {
        id: key.id,
        name: key.name,
        type: key.type,
        algorithm: key.algorithm,
        key_version: key.key_version,
        is_active: key.is_active,
        created_at: key.created_at,
        updated_at: key.updated_at,
        rotated_at: key.rotated_at,
        metadata: typeof key.metadata === 'string' ? JSON.parse(key.metadata) : key.metadata
        // Note: key_material is only included in getKey() response, not in list
      };
    }
  }
  
  module.exports = KeyService;
  ```

**Implementation Checklist**:
- [ ] Implement `createKey()` - Generate key material, encrypt with master key, store
- [ ] Implement `getKey()` - Retrieve key, decrypt key material, return
- [ ] Implement `listKeys()` - List all keys (without decrypted material)
- [ ] Implement `rotateKey()` - Create new version, mark old inactive
- [ ] Implement `encryptKey()` - Encrypt with master key using AES-256-GCM
- [ ] Implement `decryptKey()` - Decrypt with master key
- [ ] Add input validation
- [ ] Add error handling
- [ ] Add logging for key operations

### 3.2 Key Repository
- [ ] Create `api/repos/KeyRepository.js`:
  - `create(keyData)` - Create key record
  - `findByName(name)` - Find key by name
  - `findByNameAndVersion(name, version)` - Find specific version
  - `findAll(filter)` - List keys with filtering
  - `update(id, keyData)` - Update key
  - `delete(id)` - Delete key
  - `findActiveVersions(name)` - Get all active versions
  - `logAccess(keyId, accessData)` - Log key access

### 3.3 Encryption Utilities
- [ ] Create `api/utils/encryption.js`:
  - `encryptWithMasterKey(data, masterKey)` - Encrypt data with master key (AES-256-GCM)
  - `decryptWithMasterKey(encryptedData, masterKey)` - Decrypt data
  - `generateKeyMaterial(algorithm)` - Generate random key material
  - `deriveKey(masterKey, salt, info)` - PBKDF2 key derivation
  - `hashKey(key)` - Hash key for storage verification

## Phase 4: API Endpoints

### 4.1 Key Management Routes
- [ ] Create `api/routes/keys.js`:
  - `POST /api/keys` - Create new key
  - `GET /api/keys` - List all keys (with filtering)
  - `GET /api/keys/:name` - Get key by name (latest version)
  - `GET /api/keys/:name/versions` - Get all versions of a key
  - `GET /api/keys/:name/:version` - Get specific key version
  - `POST /api/keys/:name/rotate` - Rotate key
  - `DELETE /api/keys/:name` - Delete key (all versions)
  - `DELETE /api/keys/:name/:version` - Delete specific version
  - `POST /api/keys/:name/archive` - Archive key

### 4.2 Service Registration

**CRITICAL**: Service must auto-register with conductor on startup. This enables other services to discover and use key_manager.

- [ ] Create `api/utils/serviceRegistration.js`:
  ```javascript
  const axios = require('axios');
  const detectAvailablePort = require('./portDetection');
  
  async function registerWithConductor() {
    const conductorUrl = process.env.CONDUCTOR_URL;
    const serviceName = process.env.SERVICE_NAME || 'key_manager';
    const serviceVersion = process.env.SERVICE_VERSION || '1.0.0';
    
    // Auto-detect available port
    const basePort = parseInt(process.env.PORT || '3002', 10);
    const port = await detectAvailablePort(basePort);
    
    try {
      console.log(`[${serviceName}] Registering with conductor at ${conductorUrl}...`);
      
      const response = await axios.post(`${conductorUrl}/api/services/register`, {
        name: serviceName,
        version: serviceVersion,
        port: port,
        health_endpoint: '/health',
        ready_endpoint: '/ready',
        capabilities: ['key_management', 'encryption', 'key_rotation'],
        metadata: {
          description: 'Key Management Service (KMS)',
          supports: ['symmetric', 'asymmetric', 'master'],
          algorithms: ['AES-256-GCM', 'AES-128-GCM', 'RSA-4096', 'RSA-2048']
        }
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      console.log(`[${serviceName}] Successfully registered: ${response.data.service_id}`);
      console.log(`[${serviceName}] Service token: ${response.data.service_token?.substring(0, 20)}...`);
      
      // Store service token for future requests
      process.env.SERVICE_TOKEN = response.data.service_token;
      
      return response.data;
    } catch (error) {
      console.error(`[${serviceName}] Registration failed:`, error.message);
      if (error.response) {
        console.error(`[${serviceName}] Response:`, error.response.data);
      }
      throw error;
    }
  }
  
  module.exports = { registerWithConductor };
  ```

- [ ] Create `api/utils/portDetection.js`:
  ```javascript
  const net = require('net');
  
  async function detectAvailablePort(startPort) {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      
      server.listen(startPort, () => {
        const port = server.address().port;
        server.close(() => {
          console.log(`[key_manager] Detected available port: ${port}`);
          resolve(port);
        });
      });
      
      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          // Port in use, try next port
          console.log(`[key_manager] Port ${startPort} in use, trying ${startPort + 1}...`);
          detectAvailablePort(startPort + 1).then(resolve).catch(reject);
        } else {
          reject(err);
        }
      });
    });
  }
  
  module.exports = detectAvailablePort;
  ```

- [ ] Call registration in `index.js` on startup:
  ```javascript
  const { registerWithConductor } = require('./api/utils/serviceRegistration');
  
  async function startService() {
    try {
      // Register with conductor first
      await registerWithConductor();
      
      // Then start Express server
      app.listen(PORT, () => {
        console.log(`[key_manager] Server running on port ${PORT}`);
      });
    } catch (error) {
      console.error('[key_manager] Failed to start service:', error);
      process.exit(1);
    }
  }
  
  startService();
  ```

### 4.3 Authentication Middleware
- [ ] Create `api/middleware/auth.js`:
  ```javascript
  const axios = require('axios');
  
  async function validateServiceToken(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        error: { message: 'Service token required', status: 401 }
      });
    }
    
    try {
      // Validate token with conductor
      const response = await axios.post(
        `${process.env.CONDUCTOR_URL}/api/services/validate-token`,
        { token },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 5000
        }
      );
      
      req.service = response.data.service; // Attach service info
      next();
    } catch (error) {
      return res.status(401).json({
        error: { message: 'Invalid service token', status: 401 }
      });
    }
  }
  
  module.exports = validateServiceToken;
  ```

### 4.4 Main Application File (index.js)
- [ ] Create `index.js`:
  ```javascript
  require('dotenv').config();
  const express = require('express');
  const cors = require('cors');
  const { registerWithConductor } = require('./api/utils/serviceRegistration');
  const keyRoutes = require('./api/routes/keys');
  const errorHandler = require('./api/middleware/errorHandler');
  const validateServiceToken = require('./api/middleware/auth');
  
  const app = express();
  const PORT = process.env.PORT || 3002;
  
  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Health checks (no auth required)
  app.get('/health', async (req, res) => {
    try {
      // Check database connectivity
      const db = require('./api/utils/dbClient');
      await db.query('SELECT 1');
      
      res.status(200).json({
        status: 'healthy',
        service: process.env.SERVICE_NAME,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        error: error.message
      });
    }
  });
  
  app.get('/ready', async (req, res) => {
    try {
      const db = require('./api/utils/dbClient');
      await db.query('SELECT 1');
      
      // Check master key is loaded
      if (!process.env.MASTER_KEY) {
        return res.status(503).json({ status: 'not ready', reason: 'Master key not loaded' });
      }
      
      res.status(200).json({ status: 'ready' });
    } catch (error) {
      res.status(503).json({ status: 'not ready', error: error.message });
    }
  });
  
  // API routes (require authentication)
  app.use('/api', validateServiceToken);
  app.use('/api/keys', keyRoutes);
  
  // Error handling
  app.use(errorHandler);
  
  // Start server
  async function startService() {
    try {
      // Register with conductor first
      await registerWithConductor();
      
      // Start Express server
      app.listen(PORT, () => {
        console.log(`[key_manager] Server running on port ${PORT}`);
      });
    } catch (error) {
      console.error('[key_manager] Failed to start service:', error);
      process.exit(1);
    }
  }
  
  startService();
  ```

### 4.5 Error Handling Middleware
- [ ] Create `api/middleware/errorHandler.js`:
  ```javascript
  function errorHandler(err, req, res, next) {
    console.error('[Error]', err);
    
    const status = err.status || 500;
    const message = err.message || 'Internal server error';
    
    res.status(status).json({
      error: {
        message,
        status,
        timestamp: new Date().toISOString(),
        path: req.path
      }
    });
  }
  
  module.exports = errorHandler;
  ```

## Phase 5: Health Checks & Monitoring

### 5.1 Health Check Endpoints
- [ ] `GET /health` - Liveness probe:
  - Check service is running
  - Check database connectivity
  - Return 200 if healthy, 503 if unhealthy
- [ ] `GET /ready` - Readiness probe:
  - Check database is ready
  - Check master key is loaded
  - Return 200 if ready, 503 if not ready

### 5.2 Metrics Endpoint
- [ ] `GET /metrics` - Prometheus-style metrics:
  - Key count (total, active, archived)
  - Key operations (create, get, rotate, delete)
  - Error rates
  - Response times

## Phase 6: Testing

### 6.1 Unit Tests

#### KeyService Tests (`tests/unit/KeyService.test.js`)
- [x] **createKey()**:
  - Should create a symmetric key
  - Should create an asymmetric key
  - Should throw error if key already exists
  - Should throw error if required fields missing
  - Should validate key type and algorithm
  - Should encrypt key material with master key before storage
  - Should generate proper key material based on type

- [x] **getKey()**:
  - Should get key by name (latest version)
  - Should get key by name and specific version
  - Should decrypt key material before returning
  - Should throw error if key not found
  - Should include key_material in response

- [x] **listKeys()**:
  - Should list all keys
  - Should filter keys by type
  - Should filter keys by active status
  - Should not include decrypted key material in list

- [x] **rotateKey()**:
  - Should create new version
  - Should mark old version as inactive
  - Should increment version number
  - Should generate new key material
  - Should throw error if key not found
  - Should preserve key metadata

- [x] **deleteKey()**:
  - Should delete all versions of a key
  - Should throw error if key not found

- [x] **deleteKeyVersion()**:
  - Should delete specific version
  - Should throw error if version not found

- [x] **archiveKey()**:
  - Should mark key as inactive
  - Should throw error if key not found

- [x] **encryptKey() and decryptKey()**:
  - Should encrypt and decrypt key material correctly
  - Should produce different encrypted output for same data (due to random IV)
  - Should fail decryption with wrong master key
  - Should handle empty strings
  - Should handle long strings

#### KeyRepository Tests (`tests/unit/KeyRepository.test.js`)
- [x] **create()**:
  - Should create a key record
  - Should return created key with ID

- [x] **findByName()**:
  - Should find key by name (latest version)
  - Should return null if key not found
  - Should order by version DESC

- [x] **findByNameAndVersion()**:
  - Should find key by name and version
  - Should return null if not found

- [x] **findAll()**:
  - Should find all keys
  - Should filter by type
  - Should filter by active status
  - Should filter by name

- [x] **update()**:
  - Should update key by ID
  - Should return updated key

- [x] **delete()**:
  - Should delete key by ID

- [x] **findActiveVersions()**:
  - Should find all active versions of a key
  - Should order by version DESC

- [x] **logAccess()**:
  - Should log key access for audit
  - Should include service name, action, timestamp, IP, success status

#### Encryption Utilities Tests (`tests/unit/encryption.test.js`)
- [x] **encryptWithMasterKey() and decryptWithMasterKey()**:
  - Should encrypt and decrypt data correctly
  - Should produce different encrypted output for same data (random IV)
  - Should fail decryption with wrong master key
  - Should handle empty strings
  - Should handle long strings (10KB+)
  - Should return format: IV:authTag:encrypted

- [x] **generateKeyMaterial()**:
  - Should generate 256-bit key for AES-256
  - Should generate 128-bit key for AES-128
  - Should default to 256-bit for unknown algorithms
  - Should generate different keys each time

- [x] **deriveKey()**:
  - Should derive consistent key from same inputs
  - Should produce different keys with different inputs
  - Should return 256-bit (64 hex chars) key

- [x] **hashKey()**:
  - Should produce consistent hash
  - Should produce different hashes for different keys
  - Should return SHA-256 hash (64 hex chars)

#### Authentication Middleware Tests (`tests/unit/auth.test.js`)
- [x] **validateServiceToken()**:
  - Should reject request without token (401)
  - Should accept valid token and attach service info
  - Should handle invalid token (401)
  - Should allow request in dev mode if validation endpoint not found (404)
  - Should extract token from Bearer header
  - Should call conductor validation endpoint

#### Port Detection Tests (`tests/unit/portDetection.test.js`)
- [x] **detectAvailablePort()**:
  - Should detect available port
  - Should try next port if port is in use (EADDRINUSE)
  - Should return port number

### 6.2 Integration Tests

#### API Endpoints Tests (`tests/integration/api.test.js`)
- [x] **POST /api/keys**:
  - Should create a symmetric key (201)
  - Should create an asymmetric key (201)
  - Should return 400 for missing required fields
  - Should return 409 for duplicate key name
  - Should not expose key_material in create response
  - Should validate input with Joi schema

- [x] **GET /api/keys/:name**:
  - Should get key by name with decrypted key_material (200)
  - Should return 404 for non-existent key
  - Should include key_material in response

- [x] **GET /api/keys**:
  - Should list all keys
  - Should filter keys by type
  - Should filter keys by active status
  - Should return total count
  - Should not include key_material in list

- [x] **POST /api/keys/:name/rotate**:
  - Should rotate key and create new version (200)
  - Should increment version number
  - Should mark old version as inactive
  - Should return 404 for non-existent key

- [x] **DELETE /api/keys/:name**:
  - Should delete key (204)
  - Should delete all versions
  - Should return 404 for non-existent key

- [x] **DELETE /api/keys/:name/:version**:
  - Should delete specific version (204)
  - Should return 404 for non-existent version
  - Should return 400 for invalid version number

- [x] **POST /api/keys/:name/archive**:
  - Should archive key (mark as inactive) (200)
  - Should return 404 for non-existent key

- [x] **GET /api/keys/:name/versions**:
  - Should return all versions of a key

- [x] **GET /api/keys/:name/:version**:
  - Should get specific key version
  - Should include decrypted key_material

#### Service Registration Tests (`tests/integration/serviceRegistration.test.js`)
- [x] **registerWithConductor()**:
  - Should register successfully with conductor
  - Should include all required fields (name, version, port, endpoints, capabilities)
  - Should store service token in process.env
  - Should handle registration failure gracefully
  - Should handle 404 (endpoint not found) gracefully (dev mode)
  - Should use detected port
  - Should log registration success/failure

#### Key Lifecycle Tests (`tests/integration/keyLifecycle.test.js`)
- [x] **Full Lifecycle**:
  - Should complete: create → get → rotate → archive → delete
  - Should handle key versioning correctly
  - Should get specific version
  - Should get latest version
  - Should preserve metadata during rotation
  - Should mark old versions inactive after rotation

### 6.3 End-to-End Tests

#### Full Key Management Flow
- [x] **Complete Workflow**:
  - Create key → Get key → Use key → Rotate key → Get new version → Archive → Delete
  - Multiple services accessing same key
  - Key rotation with zero downtime
  - Version management

#### USB Flash Drive Mounting (Mock)
- [ ] **Entrypoint Script**:
  - Should detect USB device
  - Should mount USB drive
  - Should read master.key file
  - Should unmount USB after reading
  - Should fallback to env var if USB not present
  - Should use dev key if no USB and no env var

#### Master Key Loading
- [ ] **Master Key Handling**:
  - Should load master key from USB
  - Should load master key from environment variable
  - Should use dev key in development mode
  - Should derive 256-bit key if master key not 64 hex chars
  - Should fail if no master key available (production)

#### Service-to-Service Token Validation
- [ ] **Authentication Flow**:
  - Should validate service token with conductor
  - Should reject requests without token
  - Should reject requests with invalid token
  - Should allow requests in dev mode if validation endpoint missing
  - Should attach service info to request object

### Test Coverage Goals

- **Unit Tests**: >90% coverage
- **Integration Tests**: All API endpoints covered
- **E2E Tests**: Critical workflows covered

### Test Files Structure

```
tests/
├── unit/
│   ├── KeyService.test.js          ✅
│   ├── KeyRepository.test.js       ✅
│   ├── encryption.test.js          ✅
│   ├── auth.test.js                ✅
│   └── portDetection.test.js       ✅
├── integration/
│   ├── api.test.js                 ✅
│   ├── serviceRegistration.test.js ✅
│   └── keyLifecycle.test.js        ✅
└── helpers/
    └── testHelpers.js              ✅
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- KeyService.test.js

# Run integration tests only
npm test -- integration/
```

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
- [ ] API usage examples
- [ ] USB flash drive setup instructions

## API Documentation (OpenAPI)

```yaml
openapi: 3.0.0
info:
  title: Key Manager Service API
  version: 1.0.0
  description: Enterprise key management service for aerekos-cloud

servers:
  - url: http://localhost:3002
    description: Local development
  - url: https://conductor.example.com/api/services/key_manager
    description: Production (via conductor)

paths:
  /api/keys:
    post:
      summary: Create a new encryption key
      tags: [Keys]
      security:
        - ServiceToken: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [name, type, algorithm]
              properties:
                name:
                  type: string
                  description: Unique key identifier
                  example: "storage-encryption-key"
                type:
                  type: string
                  enum: [symmetric, asymmetric, master]
                  example: "symmetric"
                algorithm:
                  type: string
                  enum: [AES-256-GCM, AES-128-GCM, RSA-4096, RSA-2048]
                  example: "AES-256-GCM"
                metadata:
                  type: object
                  description: Additional key metadata
                  example: {"description": "Key for storage encryption"}
      responses:
        '201':
          description: Key created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Key'
        '400':
          description: Invalid request
        '401':
          description: Unauthorized
        '409':
          description: Key already exists
    
    get:
      summary: List all keys
      tags: [Keys]
      security:
        - ServiceToken: []
      parameters:
        - name: type
          in: query
          schema:
            type: string
            enum: [symmetric, asymmetric, master]
        - name: active
          in: query
          schema:
            type: boolean
        - name: limit
          in: query
          schema:
            type: integer
            default: 100
        - name: offset
          in: query
          schema:
            type: integer
            default: 0
      responses:
        '200':
          description: List of keys
          content:
            application/json:
              schema:
                type: object
                properties:
                  keys:
                    type: array
                    items:
                      $ref: '#/components/schemas/Key'
                  total:
                    type: integer
                  limit:
                    type: integer
                  offset:
                    type: integer

  /api/keys/{name}:
    get:
      summary: Get key by name (latest version)
      tags: [Keys]
      security:
        - ServiceToken: []
      parameters:
        - name: name
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Key details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Key'
        '404':
          description: Key not found

  /api/keys/{name}/rotate:
    post:
      summary: Rotate a key
      tags: [Keys]
      security:
        - ServiceToken: []
      parameters:
        - name: name
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Key rotated successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Key'
        '404':
          description: Key not found

  /api/keys/{name}/{version}:
    get:
      summary: Get specific key version
      tags: [Keys]
      security:
        - ServiceToken: []
      parameters:
        - name: name
          in: path
          required: true
        - name: version
          in: path
          required: true
          schema:
            type: integer
      responses:
        '200':
          description: Key version details
        '404':
          description: Key version not found

    delete:
      summary: Delete specific key version
      tags: [Keys]
      security:
        - ServiceToken: []
      responses:
        '204':
          description: Key version deleted
        '404':
          description: Key version not found

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
    Key:
      type: object
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
        type:
          type: string
          enum: [symmetric, asymmetric, master]
        algorithm:
          type: string
        key_version:
          type: integer
        is_active:
          type: boolean
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time
        rotated_at:
          type: string
          format: date-time
          nullable: true
        metadata:
          type: object

  securitySchemes:
    ServiceToken:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: Service-to-service token issued by conductor
```

## How Other Services Use key_manager

**For agents implementing storage_manager or other services that need encryption keys:**

### Getting an Encryption Key

```javascript
const axios = require('axios');

async function getEncryptionKey(keyName) {
  const conductorUrl = process.env.CONDUCTOR_URL;
  const serviceToken = process.env.SERVICE_TOKEN;
  
  try {
    const response = await axios.get(
      `${conductorUrl}/api/services/key_manager/api/keys/${keyName}`,
      {
        headers: {
          'Authorization': `Bearer ${serviceToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    // Response includes:
    // {
    //   id: "uuid",
    //   name: "storage-encryption-key",
    //   type: "symmetric",
    //   algorithm: "AES-256-GCM",
    //   key_version: 1,
    //   key_material: "hex-encoded-key-material",  // Decrypted key
    //   is_active: true,
    //   created_at: "2024-01-01T00:00:00Z"
    // }
    
    return response.data.key_material; // Use this for encryption
  } catch (error) {
    if (error.response?.status === 404) {
      throw new Error(`Encryption key '${keyName}' not found. Create it first via key_manager API.`);
    }
    throw new Error(`Failed to get encryption key: ${error.message}`);
  }
}
```

### Creating a New Key (if needed)

```javascript
async function createEncryptionKey(keyName) {
  const response = await axios.post(
    `${conductorUrl}/api/services/key_manager/api/keys`,
    {
      name: keyName,
      type: 'symmetric',
      algorithm: 'AES-256-GCM',
      metadata: {
        description: 'Encryption key for storage',
        service: 'storage_manager'
      }
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

### Rotating a Key

```javascript
async function rotateEncryptionKey(keyName) {
  const response = await axios.post(
    `${conductorUrl}/api/services/key_manager/api/keys/${keyName}/rotate`,
    {},
    {
      headers: {
        'Authorization': `Bearer ${serviceToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  // New version is created, old version marked inactive
  // Update your service to use the new key_version
  return response.data;
}
```

### Error Handling

- **404 Not Found**: Key doesn't exist - create it first
- **401 Unauthorized**: Service token invalid - re-register with conductor
- **500 Server Error**: key_manager is down - fail gracefully, log error

## Dependencies

### External Services
- **Conductor**: Service registration, routing, authentication
- **SQLite**: Direct database connection (no db_manager needed for key_manager)

### Service Consumers
- **storage_manager**: Encryption keys for object storage
- **All services**: General encryption key needs

## Important Notes

### Service Registration Endpoint

**CRITICAL**: The conductor must implement the service registration endpoint before services can register. This endpoint should be:

- **Endpoint**: `POST /api/services/register`
- **Request Body**:
  ```json
  {
    "name": "key_manager",
    "version": "1.0.0",
    "port": 3002,
    "health_endpoint": "/health",
    "ready_endpoint": "/ready",
    "capabilities": ["key_management", "encryption"],
    "metadata": {}
  }
  ```
- **Response**:
  ```json
  {
    "service_id": "uuid",
    "service_token": "jwt-token-for-service-auth",
    "registered_at": "2024-01-01T00:00:00Z"
  }
  ```

If this endpoint doesn't exist yet, you may need to:
1. Implement it in conductor first, OR
2. Use a temporary registration mechanism (e.g., direct database insert) for initial development

### Master Key Format

The master key from USB should be:
- **Format**: Hex string (64 characters for 256-bit key)
- **Example**: `a1b2c3d4e5f6...` (32 bytes = 64 hex chars)
- **Storage**: Never log or expose the master key in any way

## Phase 8: Frontend Integration (Conductor UI)

### 8.1 Backend API Endpoints (Conductor)

**Goal**: Create conductor API endpoints to manage key_manager service and proxy requests to it.

#### 8.1.1 Service Management Endpoints
- [ ] **POST /api/services/key_manager/enable**
  - Enable key_manager service
  - Deploy key_manager container to available worker
  - Return deployment status
  - Request body: `{ worker_id?: string }` (optional - auto-select if not provided)

- [ ] **POST /api/services/key_manager/disable**
  - Disable key_manager service
  - Stop and remove key_manager container
  - Return shutdown status

- [ ] **GET /api/services/key_manager/status**
  - Get key_manager service status
  - Return: `{ enabled: boolean, deployed: boolean, worker_id?: string, health?: object }`
  - Check if service is registered with conductor
  - Check if container is running
  - Get health status from key_manager if running

- [ ] **GET /api/services/key_manager/instances**
  - Get all key_manager instances across workers
  - Return: `{ instances: Array<{ worker_id, status, health, port }> }`

#### 8.1.2 Key Manager Proxy Endpoints
- [ ] **GET /api/services/key_manager/api/keys**
  - Proxy GET request to key_manager
  - Forward query parameters (type, active, etc.)
  - Return key list

- [ ] **POST /api/services/key_manager/api/keys**
  - Proxy POST request to key_manager
  - Forward request body (name, type, algorithm, metadata)
  - Return created key

- [ ] **GET /api/services/key_manager/api/keys/:name**
  - Proxy GET request to key_manager
  - Return key details (with decrypted key_material)

- [ ] **GET /api/services/key_manager/api/keys/:name/versions**
  - Proxy GET request to key_manager
  - Return all versions of a key

- [ ] **GET /api/services/key_manager/api/keys/:name/:version**
  - Proxy GET request to key_manager
  - Return specific key version

- [ ] **POST /api/services/key_manager/api/keys/:name/rotate**
  - Proxy POST request to key_manager
  - Rotate key and return new version

- [ ] **DELETE /api/services/key_manager/api/keys/:name**
  - Proxy DELETE request to key_manager
  - Delete key (all versions)

- [ ] **DELETE /api/services/key_manager/api/keys/:name/:version**
  - Proxy DELETE request to key_manager
  - Delete specific key version

- [ ] **POST /api/services/key_manager/api/keys/:name/archive**
  - Proxy POST request to key_manager
  - Archive key (mark as inactive)

- [ ] **GET /api/services/key_manager/health**
  - Proxy GET request to key_manager /health endpoint
  - Return health status

- [ ] **GET /api/services/key_manager/metrics**
  - Proxy GET request to key_manager /metrics endpoint
  - Return service metrics

#### 8.1.3 Implementation Details
- [ ] Create `conductor/api/services/ServiceManager.js`:
  - `enableService(serviceName, workerId?)` - Deploy service to worker
  - `disableService(serviceName)` - Stop service
  - `getServiceStatus(serviceName)` - Get service status
  - `getServiceInstances(serviceName)` - Get all instances
  - `proxyServiceRequest(serviceName, method, path, data?)` - Proxy requests

- [ ] Create `conductor/api/routes/services.js`:
  - Service management routes
  - Service proxy routes
  - Error handling for service unavailable

- [ ] Add service discovery:
  - Find key_manager instances via conductor service registry
  - Load balance requests across multiple instances
  - Handle service unavailable gracefully

- [ ] Add authentication middleware:
  - All routes require user authentication
  - Service-to-service requests use service tokens

### 8.2 Frontend Service Management Screen

**Goal**: Create a key manager management screen similar to AWS service management.

#### 8.2.1 Key Manager Service Screen
- [x] Create `conductor/app/screens/KeyManager/KeyManager.jsx`: ✅ COMPLETE
  - Service status display (enabled/disabled, health status)
  - Enable/Disable toggle button
  - Service health indicator (green/yellow/red)
  - Worker deployment info (which worker is running it)
  - Service metrics display (key count, operations)
  - Navigation to key management UI

- [x] Create `conductor/app/screens/KeyManager/KeyManager.styles.js`: ✅ COMPLETE
  - Assassin's Creed-inspired dark theme
  - Service status cards
  - Toggle button styling
  - Metrics display styling

- [x] Add service management API calls: ✅ COMPLETE
  - `keyManagerService.enable()` - Enable service
  - `keyManagerService.disable()` - Disable service
  - `keyManagerService.getStatus()` - Get status
  - `keyManagerService.getMetrics()` - Get metrics

- [x] Create `conductor/app/services/keyManagerService.js`: ✅ COMPLETE
  ```javascript
  export const keyManagerService = {
    async enable(workerId) {
      // POST /api/services/key_manager/enable
    },
    async disable() {
      // POST /api/services/key_manager/disable
    },
    async getStatus() {
      // GET /api/services/key_manager/status
    },
    async getMetrics() {
      // GET /api/services/key_manager/metrics
    },
    // Key management methods (proxied)
    async getKeys(filters) {
      // GET /api/services/key_manager/api/keys
    },
    async createKey(keyData) {
      // POST /api/services/key_manager/api/keys
    },
    // ... etc
  };
  ```

#### 8.2.2 Service Status Component
- [x] Create `conductor/app/components/ServiceStatus/ServiceStatus.jsx`: ✅ COMPLETE
  - Visual status indicator (circle with color)
  - Status text (Enabled/Disabled, Healthy/Unhealthy)
  - Last checked timestamp
  - Refresh button

- [x] Create `conductor/app/components/ServiceStatus/ServiceStatus.styles.js`: ✅ COMPLETE
  - Status indicator styling
  - Color coding (green/yellow/red)

#### 8.2.3 Service Toggle Component
- [x] Create `conductor/app/components/ServiceToggle/ServiceToggle.jsx`: ✅ COMPLETE
  - Toggle switch (on/off)
  - Loading state during enable/disable
  - Confirmation dialog for disable
  - Error handling and display

- [x] Create `conductor/app/components/ServiceToggle/ServiceToggle.styles.js`: ✅ COMPLETE
  - Toggle switch styling
  - Loading spinner styling

### 8.3 Interactive Key Management UI

**Goal**: Create an interactive UI for managing encryption keys (similar to AWS KMS console).

#### 8.3.1 Key List Screen
- [x] Create `conductor/app/screens/KeyManager/KeysList.jsx`: ✅ COMPLETE
  - Table/list of all keys
  - Columns: Name, Type, Algorithm, Version, Status (Active/Archived), Created Date
  - Filter by type (symmetric/asymmetric)
  - Filter by status (active/archived)
  - Search by key name
  - Sort by name, created date, version
  - Pagination (if many keys)
  - Refresh button
  - "Create Key" button

- [x] Create `conductor/app/screens/KeyManager/KeysList.styles.js`: ✅ COMPLETE
  - Table styling (dark theme)
  - Filter controls styling
  - Search input styling
  - Action buttons styling

#### 8.3.2 Key Details Screen
- [x] Create `conductor/app/screens/KeyManager/KeyDetails.jsx`: ✅ COMPLETE
  - Key information display:
    - Name, Type, Algorithm
    - Current version
    - Status (Active/Archived)
    - Created date, Updated date, Rotated date
    - Metadata (JSON display)
  - Key material display:
    - Show/hide toggle (eye icon)
    - Masked display when hidden
    - Copy to clipboard button
    - Warning about key material exposure
  - Version history:
    - List of all versions
    - Show active/inactive status
    - View specific version button
  - Actions:
    - Rotate Key button
    - Archive Key button
    - ~~Delete Key button~~ (REMOVED - keys should only be archived, never deleted per security best practices)
    - Back to list button

- [x] Create `conductor/app/screens/KeyManager/KeyDetails.styles.js`: ✅ COMPLETE
  - Key info card styling
  - Key material display styling
  - Version history list styling
  - Action buttons styling

#### 8.3.3 Create Key Screen
- [x] Create `conductor/app/screens/KeyManager/CreateKey.jsx`: ✅ COMPLETE
  - Form fields:
    - Key Name (required, unique)
    - Key Type (dropdown: symmetric, asymmetric)
    - Algorithm (dropdown based on type):
      - Symmetric: AES-256-GCM, AES-128-GCM
      - Asymmetric: RSA-4096, RSA-2048
    - Metadata (JSON editor, optional)
  - Form validation:
    - Key name required, min 3 chars, max 100 chars
    - Key name uniqueness check
    - Type and algorithm required
  - Submit button
  - Cancel button (back to list)
  - Success message and redirect to key details

- [x] Create `conductor/app/screens/KeyManager/CreateKey.styles.js`: ✅ COMPLETE
  - Form styling
  - Input fields styling
  - Dropdown styling
  - JSON editor styling

#### 8.3.4 Key Components
- [x] Create `conductor/app/components/KeyCard/KeyCard.jsx`: ✅ COMPLETE
  - Reusable key card component
  - Display key summary (name, type, status)
  - Click to navigate to details
  - Quick actions (rotate, archive) - delete removed per security best practices

- [x] Create `conductor/app/components/KeyMaterial/KeyMaterial.jsx`: ✅ COMPLETE
  - Key material display component
  - Show/hide toggle
  - Copy to clipboard functionality
  - Masked display (dots or asterisks)
  - Warning message about security

- [ ] Create `conductor/app/components/KeyVersionHistory/KeyVersionHistory.jsx`: ⏳ PENDING
  - Version history list component
  - Display version number, status, created date
  - View version button
  - Highlight active version

- [ ] Create `conductor/app/components/ConfirmDialog/ConfirmDialog.jsx`: ⏳ PENDING
  - Reusable confirmation dialog
  - Title, message, confirm/cancel buttons
  - Used for archive, rotate confirmations

#### 8.3.5 Key Management Features
- [x] **Key Rotation**: ✅ COMPLETE
  - Rotate button on key details screen
  - Confirmation dialog ("This will create a new version and mark the old version inactive")
  - Success message with new version number
  - Auto-refresh key details after rotation

- [x] **Key Archiving**: ✅ COMPLETE
  - Archive button on key details screen
  - Confirmation dialog
  - Update status to archived
  - Hide from active keys list (show in archived filter)

- [x] **Key Deletion**: ❌ REMOVED
  - ~~Delete button on key details screen~~ (REMOVED per security best practices)
  - ~~Strong confirmation dialog~~ (REMOVED)
  - ~~Type key name to confirm deletion~~ (REMOVED)
  - **Note**: Keys should only be archived, never deleted. This ensures historical data can always be decrypted.

- [x] **Key Material Display**: ✅ COMPLETE
  - Show key material only when explicitly requested
  - Mask by default
  - Copy to clipboard functionality
  - Warning about key material security
  - Auto-hide after 30 seconds (optional)

- [ ] **Bulk Operations** (Future): ⏳ PENDING
  - Select multiple keys
  - Bulk archive
  - Export keys list

### 8.4 Navigation Integration

- [x] Add Key Manager to Dashboard: ✅ COMPLETE
  - Add "Key Manager" card/section
  - Show service status
  - Link to Key Manager screen

- [x] Add Key Manager to navigation: ✅ COMPLETE
  - Add route: `/key-manager` → Key Manager service screen
  - Add route: `/key-manager/keys` → Keys list screen
  - Add route: `/key-manager/keys/create` → Create key screen
  - Add route: `/key-manager/keys/:name` → Key details screen

- [x] Update App.js routing: ✅ COMPLETE
  - Add key manager routes
  - Add navigation handlers

- [x] Update Header component: ✅ COMPLETE
  - Add Key Manager icon/link (optional)
  - Or add to Services menu

### 8.5 Real-time Updates

- [ ] WebSocket integration:
  - Listen for key_manager service status changes
  - Listen for key creation/rotation/deletion events (if implemented)
  - Update UI in real-time

- [ ] Polling fallback:
  - Poll service status every 30 seconds
  - Poll key list every 60 seconds (if on list screen)
  - Poll key details every 30 seconds (if on details screen)

### 8.6 Error Handling & UX

- [ ] Error states:
  - Service unavailable (show error message, retry button)
  - Network errors (show error, retry)
  - Validation errors (show inline form errors)
  - Permission errors (show message, redirect if needed)

- [ ] Loading states:
  - Loading spinner for async operations
  - Skeleton screens for data loading
  - Disable buttons during operations

- [ ] Success feedback:
  - Toast notifications for success actions
  - Success messages on forms
  - Auto-redirect after successful operations

- [ ] Empty states:
  - No keys message with "Create Key" button
  - No archived keys message
  - Service disabled message with "Enable Service" button

### 8.7 Security Considerations

- [ ] Key material security:
  - Never log key material
  - Mask key material by default
  - Show warning when displaying key material
  - Auto-hide key material after timeout
  - Clear key material from memory when navigating away

- [ ] Authentication:
  - All API calls require user authentication
  - Check user permissions (admin only for service management?)
  - Validate all inputs on frontend and backend

- [ ] Audit logging:
  - Log all key operations (create, rotate, delete, view)
  - Log service enable/disable actions
  - Display audit log in UI (future enhancement)

### 8.8 Testing

- [ ] Frontend unit tests:
  - Test KeyManager screen components
  - Test key list rendering and filtering
  - Test key creation form validation
  - Test key details display
  - Test service toggle functionality

- [ ] Integration tests:
  - Test service enable/disable flow
  - Test key CRUD operations
  - Test key rotation flow
  - Test error handling

- [ ] E2E tests:
  - Test complete key management workflow
  - Test service management workflow

### 8.9 Implementation Checklist

**Backend (Conductor)**:
- [ ] Create ServiceManager service
- [ ] Create service management routes
- [ ] Create service proxy routes
- [ ] Add service discovery
- [ ] Add authentication middleware
- [ ] Test all endpoints

**Frontend**:
- [ ] Create KeyManager service screen
- [ ] Create service status component
- [ ] Create service toggle component
- [ ] Create key list screen
- [ ] Create key details screen
- [ ] Create create key screen
- [ ] Create reusable components (KeyCard, KeyMaterial, etc.)
- [ ] Add navigation routes
- [ ] Add error handling
- [ ] Add loading states
- [ ] Add real-time updates
- [ ] Test all screens

**Documentation**:
- [ ] Update README with frontend usage
- [ ] Document API endpoints
- [ ] Create user guide for key management

## Next Steps

After completing this plan:
1. Implement storage_manager (depends on key_manager)
2. Implement db_manager (foundational service)
3. Test inter-service communication
4. Implement enterprise features (backup, disaster recovery)
5. **Implement frontend integration (Phase 8)** - Key Manager UI in conductor

