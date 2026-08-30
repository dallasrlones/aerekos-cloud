const logger = require('../../utils/logger');

/**
 * Elasticsearch Database Handler
 * Provides Elasticsearch-specific container configuration and management
 */
class ElasticsearchHandler {
  /**
   * Get Docker container configuration for Elasticsearch
   * @param {object} config - Configuration
   * @param {string} config.name - Database name
   * @param {string} config.username - Elasticsearch username
   * @param {string} config.password - Elasticsearch password
   * @param {number} config.port - Host port (optional, will use container port if not provided)
   * @param {object} config.resource_limits - Resource limits (cpu_cores, ram_gb, disk_gb)
   * @param {string} config.image - Docker image (default: docker.elastic.co/elasticsearch/elasticsearch:8.11.0)
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
      image = 'docker.elastic.co/elasticsearch/elasticsearch:8.11.0'
    } = config;

    // Container port (Elasticsearch default)
    const containerPort = 9200;
    const hostPort = port || containerPort;

    // Calculate memory settings (Elasticsearch needs specific memory settings)
    const ramGb = resource_limits.ram_gb || 2;
    const esHeapSize = Math.floor(ramGb * 0.5); // Use 50% of RAM for heap

    // Build environment variables
    const env = [
      'discovery.type=single-node',
      `ES_JAVA_OPTS=-Xms${esHeapSize}g -Xmx${esHeapSize}g`,
      `ELASTIC_PASSWORD=${password}`,
      'xpack.security.enabled=true',
      'xpack.security.enrollment.enabled=false'
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
        'aerekos.type': 'elasticsearch',
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
      '/usr/share/elasticsearch/data': {}
    };

    return containerConfig;
  }

  /**
   * Wait for Elasticsearch container to be ready
   * Polls container logs for "started"
   * @param {object} container - Docker container object
   * @param {number} timeout - Timeout in milliseconds (default: 120000)
   * @returns {Promise<void>}
   */
  async waitForReady(container, timeout = 120000) {
    const startTime = Date.now();
    const checkInterval = 2000; // Check every 2 seconds (Elasticsearch takes longer to start)

    logger.info('[ElasticsearchHandler] Waiting for Elasticsearch to be ready...');

    return new Promise((resolve, reject) => {
      const checkReady = async () => {
        try {
          const containerInfo = await container.inspect();
          if (!containerInfo.State.Running) {
            reject(new Error('Elasticsearch container stopped unexpectedly'));
            return;
          }

          const logs = await container.logs({
            stdout: true,
            stderr: true,
            tail: 100
          });

          const logText = logs.toString('utf8');
          
          if (logText.includes('started') ||
              logText.includes('started and ready') ||
              logText.includes('publish_address')) {
            logger.info('[ElasticsearchHandler] Elasticsearch is ready');
            resolve();
            return;
          }

          if (Date.now() - startTime > timeout) {
            reject(new Error(`Elasticsearch did not become ready within ${timeout}ms`));
            return;
          }

          setTimeout(checkReady, checkInterval);
        } catch (error) {
          if (error.statusCode === 404) {
            reject(new Error('Elasticsearch container was removed'));
            return;
          }
          
          if (Date.now() - startTime > timeout) {
            reject(new Error(`Elasticsearch readiness check failed: ${error.message}`));
            return;
          }
          
          setTimeout(checkReady, checkInterval);
        }
      };

      checkReady();
    });
  }

  /**
   * Get default port for Elasticsearch
   * @returns {number} Default port (9200)
   */
  getDefaultPort() {
    return 9200;
  }

  /**
   * Build connection string for Elasticsearch
   * @param {object} config - Connection config
   * @param {string} config.username - Username (default: elastic)
   * @param {string} config.password - Password
   * @param {string} config.host - Host
   * @param {number} config.port - Port
   * @param {string} config.database - Database name (not used for Elasticsearch)
   * @returns {string} Connection string
   */
  buildConnectionString(config) {
    const { username = 'elastic', password, host, port } = config;
    return `http://${username}:${password}@${host}:${port}`;
  }

  /**
   * Backup Elasticsearch indices
   * @param {object} dbInstance - Database instance record
   * @param {string} backupPath - Path to save backup file
   * @param {string} password - Decrypted password
   * @returns {Promise<void>}
   */
  async backupDatabase(dbInstance, backupPath, password) {
    const axios = require('axios');
    const logger = require('../../utils/logger');
    const fs = require('fs');
    
    const host = dbInstance.host || 'localhost';
    const port = dbInstance.port || 9200;
    const username = 'elastic';
    
    try {
      logger.info(`[ElasticsearchHandler] Creating snapshot backup`);
      
      // Elasticsearch uses snapshot API for backups
      // Create snapshot repository first, then snapshot
      const baseUrl = `http://${host}:${port}`;
      const auth = Buffer.from(`${username}:${password}`).toString('base64');
      
      // Create snapshot repository (if not exists)
      try {
        await axios.put(`${baseUrl}/_snapshot/backup_repo`, {
          type: 'fs',
          settings: {
            location: '/tmp/es_backups'
          }
        }, {
          headers: {
            'Authorization': `Basic ${auth}`
          }
        });
      } catch (error) {
        if (error.response?.status !== 400) {
          throw error;
        }
      }
      
      // Create snapshot
      const snapshotName = `snapshot-${Date.now()}`;
      await axios.put(`${baseUrl}/_snapshot/backup_repo/${snapshotName}`, {
        indices: '*',
        ignore_unavailable: true,
        include_global_state: false
      }, {
        headers: {
          'Authorization': `Basic ${auth}`
        }
      });
      
      // Wait for snapshot to complete
      let snapshotStatus = 'IN_PROGRESS';
      while (snapshotStatus === 'IN_PROGRESS') {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const statusResponse = await axios.get(`${baseUrl}/_snapshot/backup_repo/${snapshotName}`, {
          headers: { 'Authorization': `Basic ${auth}` }
        });
        snapshotStatus = statusResponse.data.snapshots[0]?.state || 'UNKNOWN';
      }
      
      if (snapshotStatus !== 'SUCCESS') {
        throw new Error(`Snapshot failed with status: ${snapshotStatus}`);
      }
      
      logger.info(`[ElasticsearchHandler] Snapshot created: ${snapshotName}`);
      logger.warn(`[ElasticsearchHandler] Backup file location: Container's /tmp/es_backups directory`);
      
      // Note: Actual backup files are in container, would need to copy them out
      // For now, we'll create a metadata file
      fs.writeFileSync(backupPath, JSON.stringify({
        snapshot_name: snapshotName,
        repository: 'backup_repo',
        location: '/tmp/es_backups',
        created_at: new Date().toISOString()
      }));
      
    } catch (error) {
      logger.error(`[ElasticsearchHandler] Backup failed: ${error.message}`);
      throw new Error(`Elasticsearch backup failed: ${error.message}`);
    }
  }

  /**
   * Restore Elasticsearch indices from backup
   * @param {object} dbInstance - Database instance record
   * @param {string} backupPath - Path to backup metadata file
   * @param {string} password - Decrypted password
   * @returns {Promise<void>}
   */
  async restoreDatabase(dbInstance, backupPath, password) {
    const axios = require('axios');
    const logger = require('../../utils/logger');
    const fs = require('fs');
    
    const host = dbInstance.host || 'localhost';
    const port = dbInstance.port || 9200;
    const username = 'elastic';
    
    try {
      logger.info(`[ElasticsearchHandler] Restoring from snapshot`);
      
      // Read snapshot metadata
      const metadata = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
      const snapshotName = metadata.snapshot_name;
      
      const baseUrl = `http://${host}:${port}`;
      const auth = Buffer.from(`${username}:${password}`).toString('base64');
      
      // Restore snapshot
      await axios.post(`${baseUrl}/_snapshot/${metadata.repository}/${snapshotName}/_restore`, {
        indices: '*',
        ignore_unavailable: true,
        include_global_state: false
      }, {
        headers: {
          'Authorization': `Basic ${auth}`
        }
      });
      
      logger.info(`[ElasticsearchHandler] Restore initiated for snapshot: ${snapshotName}`);
    } catch (error) {
      logger.error(`[ElasticsearchHandler] Restore failed: ${error.message}`);
      throw new Error(`Elasticsearch restore failed: ${error.message}`);
    }
  }

  /**
   * Check if Elasticsearch database is healthy/accessible
   * @param {object} dbInstance - Database instance record
   * @param {string} password - Decrypted password
   * @returns {Promise<{healthy: boolean, message?: string}>}
   */
  async checkHealth(dbInstance, password) {
    const axios = require('axios');
    
    const host = dbInstance.host || 'localhost';
    const port = dbInstance.port || 9200;
    const username = 'elastic';
    
    try {
      // Check Elasticsearch cluster health
      const response = await axios.get(`http://${host}:${port}/_cluster/health`, {
        auth: {
          username,
          password
        },
        timeout: 5000
      });
      
      if (response.data && response.data.status) {
        const status = response.data.status;
        // Green or yellow is healthy, red is unhealthy
        if (status === 'green' || status === 'yellow') {
          return { healthy: true, message: `Cluster status: ${status}` };
        }
        return { 
          healthy: false, 
          message: `Elasticsearch cluster status: ${status}` 
        };
      }
      return { healthy: true };
    } catch (error) {
      return { 
        healthy: false, 
        message: `Elasticsearch health check failed: ${error.message}` 
      };
    }
  }
}

module.exports = ElasticsearchHandler;

