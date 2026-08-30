const logger = require('../../utils/logger');

/**
 * PostgreSQL Database Handler
 * Provides PostgreSQL-specific container configuration and management
 */
class PostgreSQLHandler {
  /**
   * Get Docker container configuration for PostgreSQL
   * @param {object} config - Configuration
   * @param {string} config.name - Database name
   * @param {string} config.username - PostgreSQL username
   * @param {string} config.password - PostgreSQL password
   * @param {number} config.port - Host port (optional, will use container port if not provided)
   * @param {object} config.resource_limits - Resource limits (cpu_cores, ram_gb, disk_gb)
   * @param {string} config.image - Docker image (default: postgres:15-alpine)
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
      image = 'postgres:15-alpine'
    } = config;

    // Container port (PostgreSQL default)
    const containerPort = 5432;
    const hostPort = port || containerPort;

    // Build environment variables
    const env = [
      `POSTGRES_USER=${username}`,
      `POSTGRES_PASSWORD=${password}`,
      `POSTGRES_DB=${name}`
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
        'aerekos.type': 'postgresql',
        'aerekos.managed': 'true'
      }
    };

    // Add resource limits if provided
    if (resource_limits.ram_gb) {
      containerConfig.HostConfig.Memory = Math.floor(resource_limits.ram_gb * 1024 * 1024 * 1024); // Convert GB to bytes
    }

    if (resource_limits.cpu_cores) {
      containerConfig.HostConfig.NanoCPUs = Math.floor(resource_limits.cpu_cores * 1e9); // Convert cores to nanoseconds
    }

    // Storage configuration will be handled by InstanceService
    // We just need to mark the mount point
    containerConfig.Volumes = {
      '/var/lib/postgresql/data': {}
    };
    // Binds will be set by InstanceService based on storage config

    return containerConfig;
  }

  /**
   * Wait for PostgreSQL container to be ready
   * Polls container logs for "database system is ready to accept connections"
   * @param {object} container - Docker container object
   * @param {number} timeout - Timeout in milliseconds (default: 60000)
   * @returns {Promise<void>}
   */
  async waitForReady(container, timeout = 60000) {
    const startTime = Date.now();
    const checkInterval = 1000; // Check every second

    logger.info('[PostgreSQLHandler] Waiting for PostgreSQL to be ready...');

    return new Promise((resolve, reject) => {
      const checkReady = async () => {
        try {
          // Check if container is still running
          const containerInfo = await container.inspect();
          if (!containerInfo.State.Running) {
            reject(new Error('PostgreSQL container stopped unexpectedly'));
            return;
          }

          // Get container logs
          const logs = await container.logs({
            stdout: true,
            stderr: true,
            tail: 50
          });

          const logText = logs.toString('utf8');
          
          // Check for ready message
          if (logText.includes('database system is ready to accept connections') ||
              logText.includes('ready to accept connections')) {
            logger.info('[PostgreSQLHandler] PostgreSQL is ready');
            resolve();
            return;
          }

          // Check timeout
          if (Date.now() - startTime > timeout) {
            reject(new Error(`PostgreSQL did not become ready within ${timeout}ms`));
            return;
          }

          // Check again after interval
          setTimeout(checkReady, checkInterval);
        } catch (error) {
          // If container was removed, reject
          if (error.statusCode === 404) {
            reject(new Error('PostgreSQL container was removed'));
            return;
          }
          
          // For other errors, continue checking
          if (Date.now() - startTime > timeout) {
            reject(new Error(`PostgreSQL readiness check failed: ${error.message}`));
            return;
          }
          
          setTimeout(checkReady, checkInterval);
        }
      };

      // Start checking
      checkReady();
    });
  }

  /**
   * Get default port for PostgreSQL
   * @returns {number} Default port (5432)
   */
  getDefaultPort() {
    return 5432;
  }

  /**
   * Build connection string for PostgreSQL
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
    return `postgresql://${username}:${password}@${host}:${port}/${database}`;
  }

  /**
   * Backup PostgreSQL database
   * @param {object} dbInstance - Database instance record
   * @param {string} backupPath - Path to save backup file
   * @param {string} password - Decrypted password
   * @returns {Promise<void>}
   */
  async backupDatabase(dbInstance, backupPath, password) {
    const { execSync } = require('child_process');
    const logger = require('../../utils/logger');
    
    if (!password) {
      throw new Error('Password is required for PostgreSQL backup');
    }
    
    // Build pg_dump command
    const host = dbInstance.host || 'localhost';
    const port = dbInstance.port || 5432;
    const username = dbInstance.username;
    const database = dbInstance.name;
    
    // Use custom format for better compression and restore options
    const dumpCommand = `PGPASSWORD="${password}" pg_dump -h ${host} -p ${port} -U ${username} -d ${database} -F c -f ${backupPath} 2>&1`;
    
    try {
      logger.info(`[PostgreSQLHandler] Creating backup: ${backupPath}`);
      execSync(dumpCommand, { stdio: 'inherit', maxBuffer: 10 * 1024 * 1024 });
      logger.info(`[PostgreSQLHandler] Backup created successfully: ${backupPath}`);
    } catch (error) {
      logger.error(`[PostgreSQLHandler] Backup failed: ${error.message}`);
      throw new Error(`PostgreSQL backup failed: ${error.message}`);
    }
  }

  /**
   * Restore PostgreSQL database from backup
   * @param {object} dbInstance - Database instance record
   * @param {string} backupPath - Path to backup file
   * @param {string} password - Decrypted password
   * @returns {Promise<void>}
   */
  async restoreDatabase(dbInstance, backupPath, password) {
    const { execSync } = require('child_process');
    const logger = require('../../utils/logger');
    
    if (!password) {
      throw new Error('Password is required for PostgreSQL restore');
    }
    
    // Build pg_restore command
    const host = dbInstance.host || 'localhost';
    const port = dbInstance.port || 5432;
    const username = dbInstance.username;
    const database = dbInstance.name;
    
    // -c = clean (drop objects before recreating), -a = data only, -v = verbose
    const restoreCommand = `PGPASSWORD="${password}" pg_restore -h ${host} -p ${port} -U ${username} -d ${database} -c -v ${backupPath} 2>&1`;
    
    try {
      logger.info(`[PostgreSQLHandler] Restoring from backup: ${backupPath}`);
      execSync(restoreCommand, { stdio: 'inherit', maxBuffer: 10 * 1024 * 1024 });
      logger.info(`[PostgreSQLHandler] Restore completed successfully`);
    } catch (error) {
      logger.error(`[PostgreSQLHandler] Restore failed: ${error.message}`);
      throw new Error(`PostgreSQL restore failed: ${error.message}`);
    }
  }

  /**
   * Check if PostgreSQL database is healthy/accessible
   * @param {object} dbInstance - Database instance record
   * @param {string} password - Decrypted password
   * @returns {Promise<{healthy: boolean, message?: string}>}
   */
  async checkHealth(dbInstance, password) {
    const { Pool } = require('pg');
    
    // Use the actual host IP, not localhost
    // If host is 'localhost' or 'file', try to detect the actual host IP
    let host = dbInstance.host;
    if (!host || host === 'localhost' || host === 'file') {
      // Try to get host IP from environment or detect it
      if (process.env.WORKER_IP) {
        host = process.env.WORKER_IP;
      } else {
        // Try host.docker.internal for Docker Desktop
        try {
          const { execSync } = require('child_process');
          const hostIp = execSync('getent hosts host.docker.internal 2>/dev/null | awk \'{print $1}\' || echo ""', { encoding: 'utf8' }).trim();
          if (hostIp && hostIp !== '127.0.0.1' && hostIp !== '') {
            host = hostIp;
          } else {
            host = 'localhost';
          }
        } catch (error) {
          host = 'localhost';
        }
      }
    }
    
    const port = dbInstance.port || 5432;
    const username = dbInstance.username;
    const database = dbInstance.name;
    
    // Create a temporary connection pool for health check
    const pool = new Pool({
      host,
      port,
      user: username,
      password,
      database,
      max: 1,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 5000
    });
    
    try {
      // Try to connect and run a simple query
      const client = await pool.connect();
      try {
        const result = await client.query('SELECT 1 as health');
        if (result.rows && result.rows[0] && result.rows[0].health === 1) {
          return { healthy: true };
        } else {
          return { healthy: false, message: 'Health check query returned unexpected result' };
        }
      } finally {
        client.release();
      }
    } catch (error) {
      return { 
        healthy: false, 
        message: `PostgreSQL health check failed: ${error.message}` 
      };
    } finally {
      await pool.end();
    }
  }
}

module.exports = PostgreSQLHandler;

