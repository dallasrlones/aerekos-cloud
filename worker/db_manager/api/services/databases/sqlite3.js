const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');

/**
 * SQLite3 Database Handler
 * Provides SQLite3-specific file-based database management
 * Note: SQLite3 is file-based, not containerized like other databases
 */
class SQLite3Handler {
  /**
   * Get file-based configuration for SQLite3
   * @param {object} config - Configuration
   * @param {string} config.name - Database name
   * @param {string} config.projectName - Project name (for directory structure)
   * @param {string} config.basePath - Base path for databases (default: /app/data/databases)
   * @returns {object} File configuration with path and connection info
   */
  getFileConfig(config) {
    const {
      name,
      projectName = 'default',
      basePath = '/app/data/databases'
    } = config;

    // Sanitize project name and database name for filesystem safety
    const sanitizedProjectName = this.sanitizePath(projectName);
    const sanitizedDbName = this.sanitizePath(name);

    // Database file path: /app/data/databases/{projectName}/{databaseName}.db
    const dbDirectory = path.join(basePath, sanitizedProjectName);
    const dbFilePath = path.join(dbDirectory, `${sanitizedDbName}.db`);

    return {
      database: dbFilePath,
      directory: dbDirectory,
      filename: `${sanitizedDbName}.db`,
      projectName: sanitizedProjectName,
      connectionInfo: {
        type: 'sqlite',
        database: dbFilePath,
        readonly: false,
        fileMustExist: false,
        timeout: 5000
      }
    };
  }

  /**
   * Sanitize path component for filesystem safety
   * @param {string} name - Name to sanitize
   * @returns {string} Sanitized name
   */
  sanitizePath(name) {
    if (!name) return 'default';
    // Remove or replace unsafe characters
    return name
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/^_+|_+$/g, '')
      .substring(0, 100); // Limit length
  }

  /**
   * Create SQLite3 database file
   * @param {object} config - Configuration
   * @param {string} config.name - Database name
   * @param {string} config.projectName - Project name
   * @param {string} config.basePath - Base path for databases
   * @returns {Promise<object>} Database file info
   */
  async createInstance(config) {
    const fileConfig = this.getFileConfig(config);

    // Ensure directory exists
    if (!fs.existsSync(fileConfig.directory)) {
      fs.mkdirSync(fileConfig.directory, { recursive: true });
      logger.info(`[SQLite3Handler] Created directory: ${fileConfig.directory}`);
    }

    // Create database file using aerekos-record (this will create the file)
    const Record = require('aerekos-record');
    const db = Record.connect('sqlite', {
      database: fileConfig.database,
      readonly: false,
      fileMustExist: false,
      timeout: 5000
    });

    // Verify file was created
    if (!fs.existsSync(fileConfig.database)) {
      throw new Error(`SQLite database file was not created: ${fileConfig.database}`);
    }

    // Set file permissions (read/write for owner, read for group/others)
    try {
      fs.chmodSync(fileConfig.database, 0o644);
    } catch (error) {
      logger.warn(`[SQLite3Handler] Could not set file permissions: ${error.message}`);
    }

    // Test connection by running a simple query
    try {
      await db.healthCheck();
      logger.info(`[SQLite3Handler] Database created and verified: ${fileConfig.database}`);
    } catch (error) {
      throw new Error(`Failed to verify SQLite database: ${error.message}`);
    }

    return {
      database: fileConfig.database,
      directory: fileConfig.directory,
      filename: fileConfig.filename,
      connectionInfo: fileConfig.connectionInfo,
      type: 'sqlite3'
    };
  }

  /**
   * Check if SQLite3 database is healthy/accessible
   * @param {object} dbInstance - Database instance record
   * @param {string} password - Not used for SQLite3 (no password)
   * @returns {Promise<{healthy: boolean, message?: string}>}
   */
  async checkHealth(dbInstance, password) {
    const database = dbInstance.database || dbInstance.connection_string;

    if (!database) {
      return { healthy: false, message: 'Database path not found in instance record' };
    }

    try {
      // Check if file exists
      if (!fs.existsSync(database)) {
        return { healthy: false, message: `Database file does not exist: ${database}` };
      }

      // Check if file is readable
      fs.accessSync(database, fs.constants.R_OK);
      fs.accessSync(database, fs.constants.W_OK);

      // Try to connect using aerekos-record
      const Record = require('aerekos-record');
      const db = Record.connect('sqlite', {
        database: database,
        readonly: false,
        fileMustExist: true,
        timeout: 5000
      });

      // Run a simple query to verify database is not corrupted
      const healthCheck = await db.healthCheck();
      if (!healthCheck.healthy) {
        return { healthy: false, message: 'Database health check failed' };
      }

      // Try a simple SELECT query
      const result = db.prepare('SELECT 1 as test').get();
      if (!result || result.test !== 1) {
        return { healthy: false, message: 'Database query test failed' };
      }

      return { healthy: true };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { healthy: false, message: `Database file not found: ${database}` };
      }
      if (error.code === 'EACCES') {
        return { healthy: false, message: `Permission denied accessing database: ${database}` };
      }
      // Check if it's a SQLite corruption error
      if (error.message && error.message.includes('database disk image is malformed')) {
        return { healthy: false, message: 'Database file is corrupted' };
      }
      return { healthy: false, message: error.message || 'Unknown error checking database health' };
    }
  }

  /**
   * Backup SQLite3 database file
   * @param {object} dbInstance - Database instance record
   * @param {string} backupPath - Path to backup file
   * @param {string} password - Not used for SQLite3
   * @returns {Promise<void>}
   */
  async backupDatabase(dbInstance, backupPath, password) {
    const database = dbInstance.database || dbInstance.connection_string;

    if (!database) {
      throw new Error('Database path not found in instance record');
    }

    if (!fs.existsSync(database)) {
      throw new Error(`Database file does not exist: ${database}`);
    }

    try {
      // Ensure backup directory exists
      const backupDir = path.dirname(backupPath);
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      // Copy database file to backup location
      fs.copyFileSync(database, backupPath);
      
      // Preserve file permissions
      try {
        const stats = fs.statSync(database);
        fs.chmodSync(backupPath, stats.mode);
      } catch (error) {
        logger.warn(`[SQLite3Handler] Could not preserve file permissions: ${error.message}`);
      }

      logger.info(`[SQLite3Handler] Backup created: ${backupPath}`);
    } catch (error) {
      logger.error(`[SQLite3Handler] Backup failed: ${error.message}`);
      throw new Error(`SQLite3 backup failed: ${error.message}`);
    }
  }

  /**
   * Restore SQLite3 database from backup
   * @param {object} dbInstance - Database instance record
   * @param {string} backupPath - Path to backup file
   * @param {string} password - Not used for SQLite3
   * @returns {Promise<void>}
   */
  async restoreDatabase(dbInstance, backupPath, password) {
    const database = dbInstance.database || dbInstance.connection_string;

    if (!database) {
      throw new Error('Database path not found in instance record');
    }

    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file does not exist: ${backupPath}`);
    }

    try {
      // Ensure database directory exists
      const dbDir = path.dirname(database);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // Copy backup file to database location
      fs.copyFileSync(backupPath, database);

      // Set file permissions
      try {
        fs.chmodSync(database, 0o644);
      } catch (error) {
        logger.warn(`[SQLite3Handler] Could not set file permissions: ${error.message}`);
      }

      // Verify restored database is readable
      const Record = require('aerekos-record');
      const db = Record.connect('sqlite', {
        database: database,
        readonly: false,
        fileMustExist: true,
        timeout: 5000
      });

      const healthCheck = await db.healthCheck();
      if (!healthCheck.healthy) {
        throw new Error('Restored database health check failed');
      }

      logger.info(`[SQLite3Handler] Database restored from backup: ${database}`);
    } catch (error) {
      logger.error(`[SQLite3Handler] Restore failed: ${error.message}`);
      throw new Error(`SQLite3 restore failed: ${error.message}`);
    }
  }
}

module.exports = SQLite3Handler;

