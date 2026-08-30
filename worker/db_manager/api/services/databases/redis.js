const logger = require('../../utils/logger');

/**
 * Redis Database Handler
 * Provides Redis-specific container configuration and management
 */
class RedisHandler {
  /**
   * Get Docker container configuration for Redis
   * @param {object} config - Configuration
   * @param {string} config.name - Database name (not used for Redis, but kept for consistency)
   * @param {string} config.username - Redis username (optional, Redis 6+)
   * @param {string} config.password - Redis password
   * @param {number} config.port - Host port (optional, will use container port if not provided)
   * @param {object} config.resource_limits - Resource limits (cpu_cores, ram_gb, disk_gb)
   * @param {string} config.image - Docker image (default: redis:7-alpine)
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
      image = 'redis:7-alpine'
    } = config;

    // Container port (Redis default)
    const containerPort = 6379;
    const hostPort = port || containerPort;

    // Build environment variables
    const env = [];
    
    // Redis password (ACL or requirepass)
    if (password) {
      env.push(`REDIS_PASSWORD=${password}`);
    }
    
    // Redis username (Redis 6+ ACL)
    if (username) {
      env.push(`REDIS_USERNAME=${username}`);
    }

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
        'aerekos.type': 'redis',
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
      '/data': {}
    };

    return containerConfig;
  }

  /**
   * Wait for Redis container to be ready
   * Polls container logs for "Ready to accept connections"
   * @param {object} container - Docker container object
   * @param {number} timeout - Timeout in milliseconds (default: 30000)
   * @returns {Promise<void>}
   */
  async waitForReady(container, timeout = 30000) {
    const startTime = Date.now();
    const checkInterval = 1000;

    logger.info('[RedisHandler] Waiting for Redis to be ready...');

    return new Promise((resolve, reject) => {
      const checkReady = async () => {
        try {
          const containerInfo = await container.inspect();
          if (!containerInfo.State.Running) {
            reject(new Error('Redis container stopped unexpectedly'));
            return;
          }

          const logs = await container.logs({
            stdout: true,
            stderr: true,
            tail: 50
          });

          const logText = logs.toString('utf8');
          
          if (logText.includes('Ready to accept connections') ||
              logText.includes('The server is now ready to accept connections')) {
            logger.info('[RedisHandler] Redis is ready');
            resolve();
            return;
          }

          if (Date.now() - startTime > timeout) {
            reject(new Error(`Redis did not become ready within ${timeout}ms`));
            return;
          }

          setTimeout(checkReady, checkInterval);
        } catch (error) {
          if (error.statusCode === 404) {
            reject(new Error('Redis container was removed'));
            return;
          }
          
          if (Date.now() - startTime > timeout) {
            reject(new Error(`Redis readiness check failed: ${error.message}`));
            return;
          }
          
          setTimeout(checkReady, checkInterval);
        }
      };

      checkReady();
    });
  }

  /**
   * Get default port for Redis
   * @returns {number} Default port (6379)
   */
  getDefaultPort() {
    return 6379;
  }

  /**
   * Build connection string for Redis
   * @param {object} config - Connection config
   * @param {string} config.username - Username (optional)
   * @param {string} config.password - Password
   * @param {string} config.host - Host
   * @param {number} config.port - Port
   * @param {string} config.database - Database name (not used for Redis)
   * @returns {string} Connection string
   */
  buildConnectionString(config) {
    const { username, password, host, port } = config;
    if (username && password) {
      return `redis://${username}:${password}@${host}:${port}`;
    } else if (password) {
      return `redis://:${password}@${host}:${port}`;
    }
    return `redis://${host}:${port}`;
  }

  /**
   * Backup Redis database
   * @param {object} dbInstance - Database instance record
   * @param {string} backupPath - Path to save backup file
   * @param {string} password - Decrypted password (optional for Redis)
   * @returns {Promise<void>}
   */
  async backupDatabase(dbInstance, backupPath, password) {
    const { execSync } = require('child_process');
    const logger = require('../../utils/logger');
    
    const host = dbInstance.host || 'localhost';
    const port = dbInstance.port || 6379;
    
    // Redis backup: Use redis-cli BGSAVE or SAVE
    // For simplicity, we'll use redis-cli --rdb to get a snapshot
    let redisCliCommand = `redis-cli -h ${host} -p ${port}`;
    if (password) {
      redisCliCommand += ` -a "${password}"`;
    }
    
    const saveCommand = `${redisCliCommand} SAVE 2>&1`;
    const rdbPath = backupPath.replace(/\.gz$/, '.rdb');
    
    try {
      logger.info(`[RedisHandler] Creating backup: ${backupPath}`);
      
      // Trigger SAVE (synchronous, blocks until complete)
      execSync(saveCommand, { stdio: 'inherit' });
      
      // Get RDB file location (usually /data/dump.rdb in container)
      // For backup, we'll copy from container or use redis-cli --rdb
      const rdbCommand = `${redisCliCommand} --rdb ${rdbPath} 2>&1`;
      execSync(rdbCommand, { stdio: 'inherit' });
      
      // Compress the RDB file
      execSync(`gzip -c ${rdbPath} > ${backupPath} && rm -f ${rdbPath}`, { stdio: 'inherit' });
      
      logger.info(`[RedisHandler] Backup created successfully: ${backupPath}`);
    } catch (error) {
      logger.error(`[RedisHandler] Backup failed: ${error.message}`);
      throw new Error(`Redis backup failed: ${error.message}`);
    }
  }

  /**
   * Restore Redis database from backup
   * @param {object} dbInstance - Database instance record
   * @param {string} backupPath - Path to backup file
   * @param {string} password - Decrypted password (optional for Redis)
   * @returns {Promise<void>}
   */
  async restoreDatabase(dbInstance, backupPath, password) {
    const logger = require('../../utils/logger');
    
    logger.warn(`[RedisHandler] Redis restore requires manual intervention. Restore RDB file to container's /data directory and restart container.`);
    throw new Error('Redis restore requires manual intervention - restore RDB file to container and restart');
  }

  /**
   * Check if Redis database is healthy/accessible
   * @param {object} dbInstance - Database instance record
   * @param {string} password - Decrypted password (optional for Redis)
   * @returns {Promise<{healthy: boolean, message?: string}>}
   */
  async checkHealth(dbInstance, password) {
    const { execSync } = require('child_process');
    
    const host = dbInstance.host || 'localhost';
    const port = dbInstance.port || 6379;
    
    try {
      let redisCliCommand = `redis-cli -h ${host} -p ${port}`;
      if (password) {
        redisCliCommand += ` -a "${password}"`;
      }
      
      // Use PING command to check health
      const checkCommand = `${redisCliCommand} PING 2>&1`;
      const result = execSync(checkCommand, { timeout: 5000, stdio: 'pipe' }).toString().trim();
      
      if (result === 'PONG') {
        return { healthy: true };
      }
      return { 
        healthy: false, 
        message: `Redis health check failed: Expected PONG, got ${result}` 
      };
    } catch (error) {
      return { 
        healthy: false, 
        message: `Redis health check failed: ${error.message}` 
      };
    }
  }
}

module.exports = RedisHandler;

