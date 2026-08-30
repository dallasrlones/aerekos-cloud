const logger = require('../../utils/logger');

/**
 * Neo4j Database Handler
 * Provides Neo4j-specific container configuration and management
 */
class Neo4jHandler {
  /**
   * Get Docker container configuration for Neo4j
   * @param {object} config - Configuration
   * @param {string} config.name - Database name
   * @param {string} config.username - Neo4j username
   * @param {string} config.password - Neo4j password
   * @param {number} config.port - Host port for BOLT (optional, will use container port if not provided)
   * @param {object} config.resource_limits - Resource limits (cpu_cores, ram_gb, disk_gb)
   * @param {string} config.image - Docker image (default: neo4j:5)
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
      image = 'neo4j:5'
    } = config;

    // Container ports (Neo4j uses two ports: HTTP 7474 and BOLT 7687)
    const httpPort = 7474;
    const boltPort = 7687;
    const hostBoltPort = port || boltPort;
    // HTTP port is typically hostBoltPort + 1 or auto-assigned
    const hostHttpPort = port ? port + 1 : httpPort;

    // Build environment variables
    const env = [
      `NEO4J_AUTH=${username}/${password}`,
      `NEO4J_dbms_memory_heap_max__size=${resource_limits.ram_gb ? Math.floor(resource_limits.ram_gb * 0.5) + 'G' : '512M'}`,
      `NEO4J_dbms_memory_pagecache_size=${resource_limits.ram_gb ? Math.floor(resource_limits.ram_gb * 0.25) + 'G' : '256M'}`,
      'NEO4J_PLUGINS=["apoc"]'
    ];

    // Build container configuration
    const containerConfig = {
      Image: image,
      Env: env,
      ExposedPorts: {
        [`${httpPort}/tcp`]: {},
        [`${boltPort}/tcp`]: {}
      },
      HostConfig: {
        PortBindings: {
          [`${httpPort}/tcp`]: [{
            HostPort: hostHttpPort.toString()
          }],
          [`${boltPort}/tcp`]: [{
            HostPort: hostBoltPort.toString()
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
        'aerekos.type': 'neo4j',
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
    // Neo4j uses /data for database and /logs for logs
    containerConfig.Volumes = {
      '/data': {},
      '/logs': {}
    };

    return containerConfig;
  }

  /**
   * Wait for Neo4j container to be ready
   * Polls container logs for "Started"
   * @param {object} container - Docker container object
   * @param {number} timeout - Timeout in milliseconds (default: 120000)
   * @returns {Promise<void>}
   */
  async waitForReady(container, timeout = 120000) {
    const startTime = Date.now();
    const checkInterval = 2000; // Check every 2 seconds (Neo4j takes longer to start)

    logger.info('[Neo4jHandler] Waiting for Neo4j to be ready...');

    return new Promise((resolve, reject) => {
      const checkReady = async () => {
        try {
          const containerInfo = await container.inspect();
          if (!containerInfo.State.Running) {
            reject(new Error('Neo4j container stopped unexpectedly'));
            return;
          }

          const logs = await container.logs({
            stdout: true,
            stderr: true,
            tail: 100
          });

          const logText = logs.toString('utf8');
          
          if (logText.includes('Started') ||
              logText.includes('Bolt enabled') ||
              logText.includes('Remote interface available')) {
            logger.info('[Neo4jHandler] Neo4j is ready');
            resolve();
            return;
          }

          if (Date.now() - startTime > timeout) {
            reject(new Error(`Neo4j did not become ready within ${timeout}ms`));
            return;
          }

          setTimeout(checkReady, checkInterval);
        } catch (error) {
          if (error.statusCode === 404) {
            reject(new Error('Neo4j container was removed'));
            return;
          }
          
          if (Date.now() - startTime > timeout) {
            reject(new Error(`Neo4j readiness check failed: ${error.message}`));
            return;
          }
          
          setTimeout(checkReady, checkInterval);
        }
      };

      checkReady();
    });
  }

  /**
   * Get default port for Neo4j (BOLT port)
   * @returns {number} Default port (7687)
   */
  getDefaultPort() {
    return 7687;
  }

  /**
   * Build connection string for Neo4j
   * @param {object} config - Connection config
   * @param {string} config.username - Username
   * @param {string} config.password - Password
   * @param {string} config.host - Host
   * @param {number} config.port - Port (BOLT port)
   * @param {string} config.database - Database name (optional for Neo4j)
   * @returns {string} Connection string
   */
  buildConnectionString(config) {
    const { username, password, host, port } = config;
    return `bolt://${username}:${password}@${host}:${port}`;
  }

  /**
   * Backup Neo4j database
   * @param {object} dbInstance - Database instance record
   * @param {string} backupPath - Path to save backup file
   * @param {string} password - Decrypted password
   * @returns {Promise<void>}
   */
  async backupDatabase(dbInstance, backupPath, password) {
    const logger = require('../../utils/logger');
    
    // Neo4j backup requires neo4j-admin tool inside the container
    // For now, we'll backup the /data directory directly
    logger.info(`[Neo4jHandler] Neo4j backup: Backing up data directory`);
    logger.warn(`[Neo4jHandler] Neo4j backup requires container access. Use neo4j-admin dump inside container.`);
    
    // TODO: Implement proper Neo4j backup using neo4j-admin dump
    throw new Error('Neo4j backup not yet implemented - use neo4j-admin dump inside container');
  }

  /**
   * Restore Neo4j database from backup
   * @param {object} dbInstance - Database instance record
   * @param {string} backupPath - Path to backup file
   * @param {string} password - Decrypted password
   * @returns {Promise<void>}
   */
  async restoreDatabase(dbInstance, backupPath, password) {
    const logger = require('../../utils/logger');
    
    logger.warn(`[Neo4jHandler] Neo4j restore requires manual intervention. Use neo4j-admin load inside container.`);
    throw new Error('Neo4j restore not yet implemented - use neo4j-admin load inside container');
  }

  /**
   * Check if Neo4j database is healthy/accessible
   * @param {object} dbInstance - Database instance record
   * @param {string} password - Decrypted password
   * @returns {Promise<{healthy: boolean, message?: string}>}
   */
  async checkHealth(dbInstance, password) {
    const axios = require('axios');
    
    const host = dbInstance.host || 'localhost';
    const httpPort = (dbInstance.port || 7687) + 1; // HTTP port is typically BOLT port + 1
    const username = dbInstance.username;
    
    try {
      // Check Neo4j HTTP endpoint
      const response = await axios.get(`http://${host}:${httpPort}`, {
        auth: {
          username,
          password
        },
        timeout: 5000
      });
      
      if (response.status === 200) {
        return { healthy: true };
      }
      return { 
        healthy: false, 
        message: `Neo4j health check failed: HTTP ${response.status}` 
      };
    } catch (error) {
      return { 
        healthy: false, 
        message: `Neo4j health check failed: ${error.message}` 
      };
    }
  }
}

module.exports = Neo4jHandler;

