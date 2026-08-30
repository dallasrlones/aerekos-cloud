const fs = require('fs');
const path = require('path');
const Record = require('aerekos-record');
const logger = require('../../utils/logger');

const DEFAULT_TABLE = 'memory_vectors';
const BOOTSTRAP_VECTOR_DIM = 8;

/**
 * LanceDB Database Handler — provisioning via aerekos-record connectLance.
 */
class LanceDBHandler {
  getFileConfig(config) {
    const {
      name,
      projectName = 'default',
      basePath = '/app/data/databases'
    } = config;

    const sanitizedProjectName = this.sanitizePath(projectName);
    const sanitizedDbName = this.sanitizePath(name);
    const dbDirectory = path.join(basePath, sanitizedProjectName);
    const dbPath = path.join(dbDirectory, `${sanitizedDbName}.lancedb`);

    return {
      database: dbPath,
      directory: dbDirectory,
      filename: `${sanitizedDbName}.lancedb`,
      projectName: sanitizedProjectName,
      defaultTable: DEFAULT_TABLE,
      connectionInfo: {
        type: 'lancedb',
        database: dbPath,
        defaultTable: DEFAULT_TABLE
      }
    };
  }

  sanitizePath(name) {
    if (!name) return 'default';
    return name
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/^_+|_+$/g, '')
      .substring(0, 100);
  }

  async createInstance(config) {
    const fileConfig = this.getFileConfig(config);

    if (!fs.existsSync(fileConfig.directory)) {
      fs.mkdirSync(fileConfig.directory, { recursive: true });
      logger.info(`[LanceDBHandler] Created directory: ${fileConfig.directory}`);
    }

    const lance = Record.connectLance({
      database: fileConfig.database,
      table: DEFAULT_TABLE,
      vectorDim: BOOTSTRAP_VECTOR_DIM
    });
    await lance.ensureTable(DEFAULT_TABLE, BOOTSTRAP_VECTOR_DIM);

    const health = await lance.healthCheck();
    if (!health.healthy) {
      throw new Error(health.error || 'LanceDB health check failed after create');
    }

    logger.info(`[LanceDBHandler] Database created and verified: ${fileConfig.database}`);

    return {
      database: fileConfig.database,
      directory: fileConfig.directory,
      filename: fileConfig.filename,
      defaultTable: DEFAULT_TABLE,
      connectionInfo: fileConfig.connectionInfo,
      type: 'lancedb'
    };
  }

  async checkHealth(dbInstance) {
    const database = dbInstance.database || dbInstance.connection_string;
    if (!database) {
      return { healthy: false, message: 'Database path not found in instance record' };
    }

    try {
      const lance = Record.connectLance({ database, table: DEFAULT_TABLE });
      const health = await lance.healthCheck();
      if (!health.healthy) {
        return { healthy: false, message: health.error || 'LanceDB unhealthy' };
      }
      return { healthy: true };
    } catch (error) {
      return { healthy: false, message: error.message || 'Unknown error checking LanceDB health' };
    }
  }

  async backupDatabase(dbInstance, backupPath) {
    const database = dbInstance.database || dbInstance.connection_string;
    if (!database || !fs.existsSync(database)) {
      throw new Error(`LanceDB path does not exist: ${database}`);
    }

    const backupDir = path.dirname(backupPath);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    this.copyDirectory(database, backupPath);
    logger.info(`[LanceDBHandler] Backup created: ${backupPath}`);
  }

  async restoreDatabase(dbInstance, backupPath) {
    const database = dbInstance.database || dbInstance.connection_string;
    if (!backupPath || !fs.existsSync(backupPath)) {
      throw new Error(`Backup path does not exist: ${backupPath}`);
    }

    const dbDir = path.dirname(database);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    if (fs.existsSync(database)) {
      fs.rmSync(database, { recursive: true, force: true });
    }

    this.copyDirectory(backupPath, database);
    const health = await this.checkHealth({ database });
    if (!health.healthy) {
      throw new Error(health.message || 'Restored LanceDB health check failed');
    }
    logger.info(`[LanceDBHandler] Database restored from backup: ${database}`);
  }

  copyDirectory(src, dest) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        this.copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  async deleteInstance(dbInstance) {
    const database = dbInstance.database;
    if (database && fs.existsSync(database)) {
      fs.rmSync(database, { recursive: true, force: true });
      logger.info(`[LanceDBHandler] Deleted LanceDB path: ${database}`);
    }
  }
}

module.exports = LanceDBHandler;
module.exports.DEFAULT_TABLE = DEFAULT_TABLE;
