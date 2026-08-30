const logger = require('../../utils/logger');

/**
 * MongoDB Database Handler
 * Provides MongoDB-specific container configuration and management
 */
class MongoDBHandler {
  /**
   * Get Docker container configuration for MongoDB
   * @param {object} config - Configuration
   * @param {string} config.name - Database name
   * @param {string} config.username - MongoDB username
   * @param {string} config.password - MongoDB password
   * @param {number} config.port - Host port (optional, will use container port if not provided)
   * @param {object} config.resource_limits - Resource limits (cpu_cores, ram_gb, disk_gb)
   * @param {string} config.image - Docker image (default: mongo:7)
   * @returns {object} Docker container configuration
   */
  getContainerConfig(config) {
    const {
      name,
      username,
      password,
      port,
      resource_limits = {},
      storage = {},
      image = 'mongo:7'
    } = config;

    // Container port (MongoDB default)
    const containerPort = 27017;
    const hostPort = port || containerPort;

    // Build environment variables
    const env = [
      `MONGO_INITDB_ROOT_USERNAME=${username}`,
      `MONGO_INITDB_ROOT_PASSWORD=${password}`,
      `MONGO_INITDB_DATABASE=${name}`
    ];

    // Build container configuration
    const containerConfig = {
      Image: image,
      Env: env,
      ExposedPorts: {
        [`${containerPort}/tcp`]: {}
      },
      HostConfig: {
        PortBindings: {
          [`${containerPort}/tcp`]: [{
            HostPort: hostPort.toString()
          }]
        },
        RestartPolicy: {
          Name: 'unless-stopped'
        },
        AutoRemove: false
      },
      Labels: {
        'aerekos.service': 'db_manager',
        'aerekos.database': name,
        'aerekos.type': 'mongodb',
        'aerekos.managed': 'true'
      }
    };

    // Add resource limits if provided
    if (resource_limits.ram_gb) {
      containerConfig.HostConfig.Memory = Math.floor(resource_limits.ram_gb * 1024 * 1024 * 1024);
    }

    if (resource_limits.cpu_cores) {
      containerConfig.HostConfig.NanoCPUs = Math.floor(resource_limits.cpu_cores * 1e9);
    }

    // Storage configuration will be handled by InstanceService
    containerConfig.Volumes = {
      '/data/db': {}
    };

    return containerConfig;
  }

  /**
   * Wait for MongoDB container to be ready
   * Polls container logs for "Waiting for connections"
   * @param {object} container - Docker container object
   * @param {number} timeout - Timeout in milliseconds (default: 60000)
   * @returns {Promise<void>}
   */
  async waitForReady(container, timeout = 60000) {
    const startTime = Date.now();
    const checkInterval = 1000;

    logger.info('[MongoDBHandler] Waiting for MongoDB to be ready...');

    return new Promise((resolve, reject) => {
      const checkReady = async () => {
        try {
          const containerInfo = await container.inspect();
          if (!containerInfo.State.Running) {
            reject(new Error('MongoDB container stopped unexpectedly'));
            return;
          }

          const logs = await container.logs({
            stdout: true,
            stderr: true,
            tail: 50
          });

          const logText = logs.toString('utf8');
          
          if (logText.includes('Waiting for connections') ||
              logText.includes('MongoDB init process complete') ||
              logText.includes('ready to accept connections')) {
            logger.info('[MongoDBHandler] MongoDB is ready');
            resolve();
            return;
          }

          if (Date.now() - startTime > timeout) {
            reject(new Error(`MongoDB did not become ready within ${timeout}ms`));
            return;
          }

          setTimeout(checkReady, checkInterval);
        } catch (error) {
          if (error.statusCode === 404) {
            reject(new Error('MongoDB container was removed'));
            return;
          }
          
          if (Date.now() - startTime > timeout) {
            reject(new Error(`MongoDB readiness check failed: ${error.message}`));
            return;
          }
          
          setTimeout(checkReady, checkInterval);
        }
      };

      checkReady();
    });
  }

  /**
   * Get default port for MongoDB
   * @returns {number} Default port (27017)
   */
  getDefaultPort() {
    return 27017;
  }

  /**
   * Build connection string for MongoDB
   * @param {object} config - Connection config
   * @param {string} config.username - Username
   * @param {string} config.password - Password
   * @param {string} config.host - Host
   * @param {number} config.port - Port
   * @param {string} config.database - Database name
   * @returns {string} Connection string
   */
  buildConnectionString(config) {
    const { username, password, host, port, database } = config;
    return `mongodb://${username}:${password}@${host}:${port}/${database}?authSource=admin`;
  }

  /**
   * Backup MongoDB database
   * @param {object} dbInstance - Database instance record
   * @param {string} backupPath - Path to save backup file
   * @param {string} password - Decrypted password
   * @returns {Promise<void>}
   */
  async backupDatabase(dbInstance, backupPath, password) {
    const { execSync } = require('child_process');
    const logger = require('../../utils/logger');
    
    const host = dbInstance.host || 'localhost';
    const port = dbInstance.port || 27017;
    const username = dbInstance.username;
    const database = dbInstance.name;
    
    // mongodump creates a directory, so we'll archive it
    const tempDir = backupPath.replace(/\.(gz|tar\.gz)$/, '');
    const dumpCommand = `mongodump --host ${host}:${port} --username ${username} --password "${password}" --authenticationDatabase admin --db ${database} --out ${tempDir} 2>&1`;
    
    try {
      logger.info(`[MongoDBHandler] Creating backup: ${backupPath}`);
      execSync(dumpCommand, { stdio: 'inherit', maxBuffer: 10 * 1024 * 1024 });
      
      // Archive the dump directory
      execSync(`tar -czf ${backupPath} -C ${tempDir} . && rm -rf ${tempDir}`, { stdio: 'inherit' });
      
      logger.info(`[MongoDBHandler] Backup created successfully: ${backupPath}`);
    } catch (error) {
      logger.error(`[MongoDBHandler] Backup failed: ${error.message}`);
      throw new Error(`MongoDB backup failed: ${error.message}`);
    }
  }

  /**
   * Restore MongoDB database from backup
   * @param {object} dbInstance - Database instance record
   * @param {string} backupPath - Path to backup file
   * @param {string} password - Decrypted password
   * @returns {Promise<void>}
   */
  async restoreDatabase(dbInstance, backupPath, password) {
    const { execSync } = require('child_process');
    const logger = require('../../utils/logger');
    
    const host = dbInstance.host || 'localhost';
    const port = dbInstance.port || 27017;
    const username = dbInstance.username;
    const database = dbInstance.name;
    
    const tempDir = backupPath.replace(/\.(gz|tar\.gz)$/, '');
    
    try {
      logger.info(`[MongoDBHandler] Restoring from backup: ${backupPath}`);
      
      // Extract archive
      execSync(`mkdir -p ${tempDir} && tar -xzf ${backupPath} -C ${tempDir}`, { stdio: 'inherit' });
      
      // Restore using mongorestore
      const restoreCommand = `mongorestore --host ${host}:${port} --username ${username} --password "${password}" --authenticationDatabase admin --db ${database} --drop ${tempDir}/${database} 2>&1`;
      execSync(restoreCommand, { stdio: 'inherit', maxBuffer: 10 * 1024 * 1024 });
      
      // Clean up
      execSync(`rm -rf ${tempDir}`, { stdio: 'inherit' });
      
      logger.info(`[MongoDBHandler] Restore completed successfully`);
    } catch (error) {
      logger.error(`[MongoDBHandler] Restore failed: ${error.message}`);
      throw new Error(`MongoDB restore failed: ${error.message}`);
    }
  }

  /**
   * Check if MongoDB database is healthy/accessible
   * @param {object} dbInstance - Database instance record
   * @param {string} password - Decrypted password
   * @returns {Promise<{healthy: boolean, message?: string}>}
   */
  async checkHealth(dbInstance, password) {
    const { execSync } = require('child_process');
    
    const host = dbInstance.host || 'localhost';
    const port = dbInstance.port || 27017;
    const username = dbInstance.username;
    
    try {
      // Use mongosh or mongo to run a simple ping command
      const checkCommand = `mongosh --host ${host}:${port} --username ${username} --password "${password}" --authenticationDatabase admin --eval "db.adminCommand('ping')" --quiet 2>&1`;
      execSync(checkCommand, { timeout: 5000, stdio: 'pipe' });
      return { healthy: true };
    } catch (error) {
      return { 
        healthy: false, 
        message: `MongoDB health check failed: ${error.message}` 
      };
    }
  }
}

module.exports = MongoDBHandler;

