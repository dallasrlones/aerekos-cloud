const DatabaseRepository = require('../repos/DatabaseRepository');
const EncryptionService = require('./EncryptionService');
const InstanceService = require('./InstanceService');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const os = require('os');
const logger = require('../utils/logger');

class DatabaseService {
  constructor(conductorUrl, serviceToken) {
    this.repository = new DatabaseRepository();
    this.encryptionService = new EncryptionService(conductorUrl, serviceToken);
    this.instanceService = new InstanceService();
    this.databaseHandlers = new Map();
    this.conductorUrl = conductorUrl;
    this.serviceToken = serviceToken;
    this.initializeHandlers();
  }
  
  /**
   * Get host IP address for connection strings
   * Uses WORKER_IP env var if available, otherwise detects from network interfaces
   * For Docker Desktop, uses host.docker.internal IP
   * @returns {string} Host IP address
   */
  getHostIp() {
    // Priority 1: Use WORKER_IP environment variable (set by worker entrypoint)
    if (process.env.WORKER_IP) {
      logger.info(`[DatabaseService] Using WORKER_IP: ${process.env.WORKER_IP}`);
      return process.env.WORKER_IP;
    }

    // Priority 2: For Docker Desktop, try to resolve host.docker.internal
    try {
      const dns = require('dns');
      const { execSync } = require('child_process');
      // Try to resolve host.docker.internal using getent (works in Docker)
      const hostIp = execSync('getent hosts host.docker.internal 2>/dev/null | awk \'{print $1}\' || echo ""', { encoding: 'utf8' }).trim();
      if (hostIp && hostIp !== '127.0.0.1' && hostIp !== '') {
        logger.info(`[DatabaseService] Using host.docker.internal IP: ${hostIp}`);
        return hostIp;
      }
    } catch (error) {
      // Ignore errors, try next method
    }

    // Priority 3: Try to get gateway IP (for Docker Desktop, gateway is often the host)
    try {
      const { execSync } = require('child_process');
      const gateway = execSync('ip route | grep default | awk \'{print $3}\' 2>/dev/null || echo ""', { encoding: 'utf8' }).trim();
      if (gateway && !gateway.startsWith('172.17.') && !gateway.startsWith('172.19.')) {
        // Gateway is not a Docker network IP, likely the host IP
        logger.info(`[DatabaseService] Using gateway as host IP: ${gateway}`);
        return gateway;
      }
    } catch (error) {
      // Ignore errors, try next method
    }

    // Priority 4: Detect from network interfaces (skip Docker networks)
    try {
      const interfaces = os.networkInterfaces();
      for (const name of Object.keys(interfaces)) {
        // Skip Docker interfaces
        if (name.startsWith('docker') || name.startsWith('br-') || name.startsWith('veth')) {
          continue;
        }
        for (const iface of interfaces[name]) {
          // Skip Docker network IPs (172.17.x.x, 172.19.x.x, 172.18.x.x)
          if (iface.family === 'IPv4' && !iface.internal && 
              !iface.address.startsWith('172.17.') && 
              !iface.address.startsWith('172.18.') && 
              !iface.address.startsWith('172.19.')) {
            logger.info(`[DatabaseService] Detected host IP: ${iface.address} from interface ${name}`);
            return iface.address;
          }
        }
      }
    } catch (error) {
      logger.warn(`[DatabaseService] Error detecting host IP: ${error.message}`);
    }

    // Fallback: use localhost (will work for same-host connections)
    logger.warn('[DatabaseService] Could not detect host IP, using localhost');
    return 'localhost';
  }

  /**
   * Get project name from project ID
   * @param {string} projectId - Project ID
   * @returns {Promise<string|null>} Project name or null
   */
  async getProjectName(projectId) {
    if (!projectId || !this.conductorUrl) {
      return null;
    }
    
    try {
      const axios = require('axios');
      const response = await axios.get(
        `${this.conductorUrl}/api/projects/${projectId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.serviceToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 5000
        }
      );
      const projectName = response.data.project?.name || null;
      if (projectName) {
        logger.info(`[DatabaseService] Fetched project name '${projectName}' for project ${projectId}`);
      } else {
        logger.warn(`[DatabaseService] Project name not found in response for ${projectId}`);
      }
      return projectName;
    } catch (error) {
      logger.warn(`[DatabaseService] Could not fetch project name for ${projectId}: ${error.message} (status: ${error.response?.status})`);
      return null;
    }
  }

  /**
   * Initialize database type handlers
   */
  initializeHandlers() {
    // Load PostgreSQL handler
    try {
      const PostgreSQLHandler = require('./databases/postgresql');
      this.databaseHandlers.set('postgresql', new PostgreSQLHandler());
      logger.info('[DatabaseService] Loaded PostgreSQL handler');
    } catch (error) {
      logger.warn('[DatabaseService] Could not load PostgreSQL handler:', error.message);
    }

    // Load MongoDB handler
    try {
      const MongoDBHandler = require('./databases/mongodb');
      this.databaseHandlers.set('mongodb', new MongoDBHandler());
      logger.info('[DatabaseService] Loaded MongoDB handler');
    } catch (error) {
      logger.warn('[DatabaseService] Could not load MongoDB handler:', error.message);
    }

    // Load Neo4j handler
    try {
      const Neo4jHandler = require('./databases/neo4j');
      this.databaseHandlers.set('neo4j', new Neo4jHandler());
      logger.info('[DatabaseService] Loaded Neo4j handler');
    } catch (error) {
      logger.warn('[DatabaseService] Could not load Neo4j handler:', error.message);
    }

    // Load Elasticsearch handler
    try {
      const ElasticsearchHandler = require('./databases/elasticsearch');
      this.databaseHandlers.set('elasticsearch', new ElasticsearchHandler());
      logger.info('[DatabaseService] Loaded Elasticsearch handler');
    } catch (error) {
      logger.warn('[DatabaseService] Could not load Elasticsearch handler:', error.message);
    }

    // Load Redis handler
    try {
      const RedisHandler = require('./databases/redis');
      this.databaseHandlers.set('redis', new RedisHandler());
      logger.info('[DatabaseService] Loaded Redis handler');
    } catch (error) {
      logger.warn('[DatabaseService] Could not load Redis handler:', error.message);
    }

    // Load SQLite3 handler
    try {
      const SQLite3Handler = require('./databases/sqlite3');
      this.databaseHandlers.set('sqlite3', new SQLite3Handler());
      logger.info('[DatabaseService] Loaded SQLite3 handler');
    } catch (error) {
      logger.warn('[DatabaseService] Could not load SQLite3 handler:', error.message);
    }
  }

  /**
   * Get database handler for type
   * @param {string} type - Database type
   * @returns {object} Database handler
   */
  getHandler(type) {
    const handler = this.databaseHandlers.get(type);
    if (!handler) {
      throw new Error(`Database type '${type}' is not supported`);
    }
    return handler;
  }

  /**
   * Create a new database instance
   * @param {string} name - Database name
   * @param {string} type - Database type (postgresql, mongodb, etc.)
   * @param {string} projectId - Project ID (required)
   * @param {object} config - Configuration (username, password, port, worker_id, resource_limits, etc.)
   * @returns {Promise<object>} Created database instance
   */
  async createDatabase(name, type, projectId, config = {}) {
    if (!projectId) {
      throw new Error('projectId is required for database creation');
    }
    
    // Check if database already exists in this project
    const existing = await this.repository.findByName(name, projectId);
    if (existing) {
      throw new Error(`Database '${name}' already exists in project ${projectId}`);
    }

    // Get project name for container naming
    const projectName = await this.getProjectName(projectId);

    // Get database handler
    const handler = this.getHandler(type);

    // SQLite3 is file-based and doesn't need username/password/port
    let username, password, port, host, connectionString, encryptedConnectionString, encryptedPassword, passwordHash;
    
    if (type === 'sqlite3') {
      // SQLite3 doesn't use credentials or ports
      username = null;
      password = null;
      port = null;
      host = 'file';
      // Connection string will be set after file creation
      encryptedConnectionString = null;
      encryptedPassword = null;
      passwordHash = null;
    } else {
      // Use provided credentials or generate new ones
      username = config.username || this.generateUsername(name);
      password = config.password || this.generatePassword();

      // Find available port if not provided
      port = config.port;
      if (!port) {
        const defaultPort = handler.getDefaultPort ? handler.getDefaultPort() : this.getDefaultPort(type);
        port = await this.instanceService.findAvailablePort(defaultPort);
      }

      // Get host IP address for connection strings (use actual network IP, not localhost)
      host = this.getHostIp();

      // Build connection string (will be encrypted before storage)
      connectionString = this.buildConnectionString(type, {
        username,
        password,
        host,
        port,
        database: name
      });

      // Encrypt connection string and password using key_manager
      encryptedConnectionString = await this.encryptionService.encryptData(
        connectionString,
        'db-manager-encryption-key',
        projectId
      );
      encryptedPassword = await this.encryptionService.encryptData(
        password,
        'db-manager-encryption-key',
        projectId
      );

      // Hash password for verification (in addition to encryption)
      passwordHash = await bcrypt.hash(password, 10);
    }

      // Create database instance record with 'creating' status
    const containerName = projectName 
      ? `aerekos-${projectName}-db-${name}`
      : `aerekos-db-${name}`;
    
    // Store storage configuration in metadata
    const metadata = {
      ...(config.metadata || {}),
      storage: config.storage || { type: 'volume' }
    };
    
    const dbInstance = await this.repository.create({
      name,
      type,
      project_id: projectId,
      worker_id: config.worker_id || null,
      status: 'creating',
      port,
      connection_string: encryptedConnectionString,
      username,
      password_hash: passwordHash,
      password_encrypted: encryptedPassword,
      resource_limits: JSON.stringify(config.resource_limits || {}),
      metadata: JSON.stringify(metadata),
      container_name: containerName,
      host
    });

    try {
      // SQLite3 is file-based, not containerized
      if (type === 'sqlite3') {
        // Create database file using handler
        logger.info(`[DatabaseService] Creating SQLite3 database file for '${name}' in project ${projectName || projectId}...`);
        const fileInfo = await handler.createInstance({
          name,
          projectName,
          basePath: config.basePath || '/app/data/databases'
        });

        // Encrypt connection info for SQLite3
        const encryptedConnectionInfo = await this.encryptionService.encryptData(
          JSON.stringify(fileInfo.connectionInfo),
          'db-manager-encryption-key',
          projectId
        );

        // Update database record with file info and running status
        const updatedInstance = await this.repository.update(dbInstance.id, {
          status: 'running',
          container_name: null, // No container for SQLite3
          port: null, // No port for SQLite3
          host: 'file', // Special marker for file-based databases
          connection_string: encryptedConnectionInfo,
          metadata: JSON.stringify({
            ...metadata,
            database: fileInfo.database,
            directory: fileInfo.directory,
            filename: fileInfo.filename
          })
        });

        logger.info(`[DatabaseService] Successfully created SQLite3 database '${name}' at ${fileInfo.database}`);
        return updatedInstance;
      } else {
        // Containerized databases (PostgreSQL, MongoDB, etc.)
        // Get container configuration from handler
        const containerConfig = handler.getContainerConfig({
          name,
          username,
          password,
          port,
          resource_limits: config.resource_limits || {},
          storage: config.storage || {},
          image: config.image
        });

        // Create container using InstanceService
        logger.info(`[DatabaseService] Creating ${type} container for database '${name}' in project ${projectName || projectId}...`);
        const containerInfo = await this.instanceService.createInstance({
          name,
          type,
          containerConfig,
          projectName,
          storage: config.storage || {},
          waitForReady: handler.waitForReady ? handler.waitForReady.bind(handler) : null
        });

        // Update database record with container info and running status
        const updatedInstance = await this.repository.update(dbInstance.id, {
          status: 'running',
          container_name: containerInfo.name,
          port: containerInfo.port,
          host: containerInfo.host
        });

        logger.info(`[DatabaseService] Successfully created ${type} database '${name}'`);
        return updatedInstance;
      }
    } catch (error) {
      // Update status to failed
      await this.repository.update(dbInstance.id, { status: 'failed' });
      logger.error(`[DatabaseService] Failed to create ${type} database '${name}':`, error);
      throw error;
    }
  }

  /**
   * Get database instance by name and projectId
   * @param {string} name - Database name
   * @param {string} projectId - Project ID
   * @returns {Promise<object>} Database instance
   */
  async getDatabase(name, projectId) {
    if (!projectId) {
      throw new Error('projectId is required for database queries');
    }
    const dbInstance = await this.repository.findByName(name, projectId);
    if (!dbInstance) {
      throw new Error(`Database '${name}' not found in project ${projectId}`);
    }
    return dbInstance;
  }

  /**
   * List all databases with optional filtering
   * @param {string} projectId - Project ID (required)
   * @param {object} filter - Filter options (type, worker_id, status)
   * @returns {Promise<Array>} List of database instances
   */
  async listDatabases(projectId, filter = {}) {
    if (!projectId) {
      throw new Error('projectId is required for database queries');
    }
    
    const queryFilter = { project_id: projectId };
    if (filter.type) queryFilter.type = filter.type;
    if (filter.status) queryFilter.status = filter.status;
    if (filter.worker_id) queryFilter.worker_id = filter.worker_id;
    
    return await this.repository.findAll(queryFilter);
  }

  /**
   * Delete database instance
   * @param {string} name - Database name
   * @param {string} projectId - Project ID
   * @returns {Promise<void>}
   */
  async deleteDatabase(name, projectId) {
    if (!projectId) {
      throw new Error('projectId is required for database operations');
    }
    const dbInstance = await this.repository.findByName(name, projectId);
    if (!dbInstance) {
      throw new Error(`Database '${name}' not found in project ${projectId}`);
    }

    // Get project name for container naming
    const projectName = await this.getProjectName(projectId);

    // Extract storage config from metadata
    let storage = null;
    try {
      const metadata = JSON.parse(dbInstance.metadata || '{}');
      storage = metadata.storage || null;
    } catch (error) {
      logger.warn(`[DatabaseService] Could not parse storage config from metadata: ${error.message}`);
    }

    // Delete container and volume
    try {
      await this.instanceService.deleteInstance(name, projectName, storage);
      logger.info(`[DatabaseService] Deleted container for database '${name}'`);
    } catch (error) {
      // Log error but continue with database record deletion
      logger.warn(`[DatabaseService] Error deleting container for '${name}': ${error.message}`);
    }

    // Delete database record
    await this.repository.delete(dbInstance.id);
  }

  /**
   * Start a database container
   * @param {string} name - Database name
   * @param {string} projectId - Project ID
   * @returns {Promise<object>} Updated database instance
   */
  async startDatabase(name, projectId) {
    if (!projectId) {
      throw new Error('projectId is required for database operations');
    }
    const dbInstance = await this.repository.findByName(name, projectId);
    if (!dbInstance) {
      throw new Error(`Database '${name}' not found in project ${projectId}`);
    }

    // Get project name for container naming
    const projectName = await this.getProjectName(projectId);

    try {
      await this.instanceService.startInstance(name, projectName);
      logger.info(`[DatabaseService] Started container for database '${name}'`);
      
      // Update status to running
      return await this.repository.update(dbInstance.id, { status: 'running' });
    } catch (error) {
      logger.error(`[DatabaseService] Error starting database '${name}':`, error);
      throw error;
    }
  }

  /**
   * Stop a database container
   * @param {string} name - Database name
   * @param {string} projectId - Project ID
   * @returns {Promise<object>} Updated database instance
   */
  async stopDatabase(name, projectId) {
    if (!projectId) {
      throw new Error('projectId is required for database operations');
    }
    const dbInstance = await this.repository.findByName(name, projectId);
    if (!dbInstance) {
      throw new Error(`Database '${name}' not found in project ${projectId}`);
    }

    // Get project name for container naming
    const projectName = await this.getProjectName(projectId);

    try {
      await this.instanceService.stopInstance(name, projectName);
      logger.info(`[DatabaseService] Stopped container for database '${name}'`);
      
      // Update status to stopped
      return await this.repository.update(dbInstance.id, { status: 'stopped' });
    } catch (error) {
      logger.error(`[DatabaseService] Error stopping database '${name}':`, error);
      throw error;
    }
  }

  /**
   * Restart a database container
   * @param {string} name - Database name
   * @returns {Promise<object>} Updated database instance
   */
  async restartDatabase(name, projectId) {
    if (!projectId) {
      throw new Error('projectId is required for database operations');
    }
    const dbInstance = await this.repository.findByName(name, projectId);
    if (!dbInstance) {
      throw new Error(`Database '${name}' not found in project ${projectId}`);
    }

    // Get project name for container naming
    const projectName = await this.getProjectName(projectId);

    try {
      const result = await this.instanceService.restartInstance(name, projectName);
      logger.info(`[DatabaseService] Restarted container for database '${name}'`);
      
      // Update status based on container state
      const status = result.status === 'running' ? 'running' : 'stopped';
      return await this.repository.update(dbInstance.id, { status });
    } catch (error) {
      logger.error(`[DatabaseService] Error restarting database '${name}':`, error);
      throw error;
    }
  }

  /**
   * Get decrypted connection string for a database
   * @param {string} name - Database name
   * @returns {Promise<string>} Decrypted connection string
   */
  async getConnectionString(name, projectId) {
    const dbInstance = await this.getDatabase(name, projectId);
    
    // SQLite3 stores connection info as JSON, others as connection string
    if (dbInstance.type === 'sqlite3') {
      // Decrypt and return connection info JSON
      const decryptedConnectionInfo = await this.encryptionService.decryptData(
        dbInstance.connection_string,
        'db-manager-encryption-key',
        projectId
      );
      return decryptedConnectionInfo; // Returns JSON string with connection info
    } else {
      // Decrypt connection string using key_manager
      const decryptedConnectionString = await this.encryptionService.decryptData(
        dbInstance.connection_string,
        'db-manager-encryption-key',
        projectId
      );
      return decryptedConnectionString;
    }
  }

  /**
   * Check database health
   * @param {string} name - Database name
   * @param {string} projectId - Project ID
   * @returns {Promise<{healthy: boolean, message?: string}>}
   */
  async checkHealth(name, projectId) {
    if (!projectId) {
      throw new Error('projectId is required for database operations');
    }
    
    const dbInstance = await this.repository.findByName(name, projectId);
    if (!dbInstance) {
      throw new Error(`Database '${name}' not found in project ${projectId}`);
    }

    // Get handler for this database type
    const handler = this.getHandler(dbInstance.type);
    
    // Check if handler has checkHealth method
    if (!handler || typeof handler.checkHealth !== 'function') {
      return { 
        healthy: false, 
        message: `Health check not supported for database type '${dbInstance.type}'` 
      };
    }

    try {
      // SQLite3 doesn't use passwords
      let password = null;
      if (dbInstance.type !== 'sqlite3') {
        password = await this.getPassword(name, projectId);
      }

      // For SQLite3, pass the database path from metadata
      if (dbInstance.type === 'sqlite3') {
        const metadata = JSON.parse(dbInstance.metadata || '{}');
        const sqliteDbInstance = {
          ...dbInstance,
          database: metadata.database || dbInstance.connection_string
        };
        return await handler.checkHealth(sqliteDbInstance, null);
      }
      
      // Call handler's health check for containerized databases
      return await handler.checkHealth(dbInstance, password);
    } catch (error) {
      logger.error(`[DatabaseService] Error checking health for '${name}':`, error);
      return { 
        healthy: false, 
        message: `Health check failed: ${error.message}` 
      };
    }
  }

  /**
   * Parse connection string to extract components
   * @param {string} connectionString - Connection string
   * @returns {object} Parsed connection components
   */
  parseConnectionString(connectionString) {
    try {
      const url = new URL(connectionString);
      return {
        protocol: url.protocol.replace(':', ''),
        username: url.username,
        password: url.password,
        host: url.hostname,
        port: parseInt(url.port) || this.getDefaultPort(url.protocol.replace(':', '')),
        database: url.pathname.replace('/', '')
      };
    } catch (error) {
      throw new Error(`Invalid connection string format: ${error.message}`);
    }
  }

  /**
   * Get decrypted password for a database
   * @param {string} name - Database name
   * @returns {Promise<string>} Decrypted password
   */
  async getPassword(name, projectId) {
    const dbInstance = await this.getDatabase(name, projectId);
    
    // Decrypt password using key_manager
    const decryptedPassword = await this.encryptionService.decryptData(
      dbInstance.password_encrypted,
      'db-manager-encryption-key',
      projectId
    );
    
    return decryptedPassword;
  }

  /**
   * Update database instance status
   * @param {string} name - Database name
   * @param {string} status - New status
   * @returns {Promise<object>} Updated database instance
   */
  async updateStatus(name, status) {
    const dbInstance = await this.getDatabase(name);
    return await this.repository.update(dbInstance.id, { status });
  }

  /**
   * Generate secure username from database name
   * @param {string} dbName - Database name
   * @returns {string} Username
   */
  generateUsername(dbName) {
    // Create username from database name (sanitized)
    const sanitized = dbName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    return `db_${sanitized}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Generate secure random password
   * @returns {string} Password
   */
  generatePassword() {
    // Generate 32-character random password
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Build connection string for database type
   * @param {string} type - Database type
   * @param {object} config - Connection config
   * @returns {string} Connection string
   */
  buildConnectionString(type, config) {
    // SQLite3 doesn't use connection strings (file-based)
    if (type === 'sqlite3') {
      throw new Error('SQLite3 is file-based and does not use connection strings');
    }

    const handler = this.getHandler(type);
    if (handler && handler.buildConnectionString) {
      return handler.buildConnectionString(config);
    }
    
    // Fallback for unsupported types
    throw new Error(`Unsupported database type: ${type}`);
  }

  /**
   * Get default port for database type
   * @param {string} type - Database type
   * @returns {number} Default port
   */
  getDefaultPort(type) {
    const ports = {
      postgresql: 5432,
      mongodb: 27017,
      redis: 6379,
      neo4j: 7687,
      elasticsearch: 9200,
      sqlite3: null // File-based, no port
    };
    return ports[type] || null;
  }
}

module.exports = DatabaseService;
