const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const logger = require('../utils/logger');
const DatabaseRepository = require('../repos/DatabaseRepository');

/**
 * BackupService - Handles database backups and integration with storage_manager
 */
class BackupService {
  constructor(conductorUrl, serviceToken, databaseService = null) {
    this.conductorUrl = conductorUrl;
    this.serviceToken = serviceToken;
    this.repository = new DatabaseRepository();
    this.databaseService = databaseService; // Reference to DatabaseService for password decryption
    this.backupBucketName = 'db-backups';
  }

  /**
   * Create a backup of a database
   * @param {string} databaseName - Database name
   * @param {string} projectId - Project ID
   * @param {string} backupType - 'full' or 'incremental' (default: 'full')
   * @returns {Promise<object>} Backup record
   */
  async createBackup(databaseName, projectId, backupType = 'full') {
    if (!projectId) {
      throw new Error('projectId is required for backup operations');
    }

    const dbInstance = await this.repository.findByName(databaseName, projectId);
    if (!dbInstance) {
      throw new Error(`Database '${databaseName}' not found in project ${projectId}`);
    }

    const handler = this.getDatabaseHandler(dbInstance.type);
    if (!handler || !handler.backupDatabase) {
      throw new Error(`Backup not supported for database type: ${dbInstance.type}`);
    }

    const backupId = require('crypto').randomUUID();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `${databaseName}-${timestamp}-${backupId}.${this.getBackupExtension(dbInstance.type)}`;
    const localBackupPath = path.join('/tmp', backupFileName);

    try {
      logger.info(`[BackupService] Creating ${backupType} backup for database '${databaseName}'`);

      // Get decrypted password for backup
      let password = null;
      if (this.databaseService) {
        try {
          password = await this.databaseService.getPassword(databaseName, projectId);
        } catch (error) {
          logger.warn(`[BackupService] Could not get password: ${error.message}`);
        }
      }

      // Create backup using database handler
      await handler.backupDatabase(dbInstance, localBackupPath, password);

      // Get backup file size
      const backupStats = fs.statSync(localBackupPath);
      const backupSize = backupStats.size;

      // Upload to storage_manager
      let storagePath = null;
      try {
        storagePath = await this.uploadBackupToStorage(projectId, localBackupPath, backupFileName);
        logger.info(`[BackupService] Backup uploaded to storage_manager: ${storagePath}`);
      } catch (error) {
        logger.warn(`[BackupService] Failed to upload backup to storage_manager: ${error.message}`);
        // Keep backup locally if storage_manager unavailable
        storagePath = localBackupPath;
      }

      // Create backup record in database
      const backupRecord = {
        id: backupId,
        database_instance_id: dbInstance.id,
        backup_type: backupType,
        status: 'completed',
        size_bytes: backupSize,
        storage_path: storagePath,
        metadata: JSON.stringify({
          database_name: databaseName,
          database_type: dbInstance.type,
          created_at: new Date().toISOString(),
          backup_type: backupType
        }),
        created_at: new Date().toISOString()
      };

      // Save backup record (if DatabaseBackup model exists)
      // For now, we'll return the backup info
      // TODO: Save to DatabaseBackup model when implemented

      // Clean up local backup file if uploaded successfully
      if (storagePath !== localBackupPath && fs.existsSync(localBackupPath)) {
        fs.unlinkSync(localBackupPath);
        logger.info(`[BackupService] Cleaned up local backup file: ${localBackupPath}`);
      }

      return backupRecord;
    } catch (error) {
      logger.error(`[BackupService] Error creating backup for '${databaseName}':`, error);
      
      // Clean up local backup file on error
      if (fs.existsSync(localBackupPath)) {
        try {
          fs.unlinkSync(localBackupPath);
        } catch (cleanupError) {
          logger.warn(`[BackupService] Failed to clean up backup file: ${cleanupError.message}`);
        }
      }
      
      throw error;
    }
  }

  /**
   * Restore a database from a backup
   * @param {string} databaseName - Database name
   * @param {string} projectId - Project ID
   * @param {string} backupId - Backup ID or storage path
   * @returns {Promise<object>} Restore result
   */
  async restoreBackup(databaseName, projectId, backupId) {
    if (!projectId) {
      throw new Error('projectId is required for restore operations');
    }

    const dbInstance = await this.repository.findByName(databaseName, projectId);
    if (!dbInstance) {
      throw new Error(`Database '${databaseName}' not found in project ${projectId}`);
    }

    const handler = this.getDatabaseHandler(dbInstance.type);
    if (!handler || !handler.restoreDatabase) {
      throw new Error(`Restore not supported for database type: ${dbInstance.type}`);
    }

    const localBackupPath = path.join('/tmp', `restore-${backupId}-${Date.now()}.${this.getBackupExtension(dbInstance.type)}`);

    try {
      logger.info(`[BackupService] Restoring database '${databaseName}' from backup '${backupId}'`);

      // Get decrypted password for restore
      let password = null;
      if (this.databaseService) {
        try {
          password = await this.databaseService.getPassword(databaseName, projectId);
        } catch (error) {
          logger.warn(`[BackupService] Could not get password: ${error.message}`);
        }
      }

      // Download backup from storage_manager
      await this.downloadBackupFromStorage(projectId, backupId, localBackupPath);

      // Restore using database handler
      await handler.restoreDatabase(dbInstance, localBackupPath, password);

      // Clean up local backup file
      if (fs.existsSync(localBackupPath)) {
        fs.unlinkSync(localBackupPath);
      }

      logger.info(`[BackupService] Successfully restored database '${databaseName}'`);

      return {
        success: true,
        database: databaseName,
        backup_id: backupId,
        restored_at: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`[BackupService] Error restoring backup for '${databaseName}':`, error);
      
      // Clean up local backup file on error
      if (fs.existsSync(localBackupPath)) {
        try {
          fs.unlinkSync(localBackupPath);
        } catch (cleanupError) {
          logger.warn(`[BackupService] Failed to clean up backup file: ${cleanupError.message}`);
        }
      }
      
      throw error;
    }
  }

  /**
   * Upload backup to storage_manager
   * @param {string} projectId - Project ID
   * @param {string} backupPath - Local backup file path
   * @param {string} backupFileName - Backup file name
   * @returns {Promise<string>} Storage path
   */
  async uploadBackupToStorage(projectId, backupPath, backupFileName) {
    try {
      // Ensure backup bucket exists
      await this.ensureBackupBucket(projectId);

      // Read backup file as stream
      const fileStream = fs.createReadStream(backupPath);
      const fileStats = fs.statSync(backupPath);

      // Upload to storage_manager via conductor
      const storageKey = `backups/${backupFileName}`;
      const uploadUrl = `${this.conductorUrl}/api/services/storage_manager/api/projects/${projectId}/buckets/${this.backupBucketName}/files/${storageKey}`;

      const FormData = require('form-data');
      const formData = new FormData();
      formData.append('file', fileStream, {
        filename: backupFileName,
        contentType: 'application/gzip',
        knownLength: fileStats.size
      });

      const response = await axios.post(uploadUrl, formData, {
        headers: {
          'Authorization': `Bearer ${this.serviceToken}`,
          ...formData.getHeaders()
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 300000 // 5 minutes for large backups
      });

      return storageKey;
    } catch (error) {
      logger.error(`[BackupService] Error uploading backup to storage_manager:`, error);
      throw new Error(`Failed to upload backup to storage: ${error.message}`);
    }
  }

  /**
   * Download backup from storage_manager
   * @param {string} projectId - Project ID
   * @param {string} backupId - Backup ID or storage path
   * @param {string} localPath - Local path to save backup
   * @returns {Promise<void>}
   */
  async downloadBackupFromStorage(projectId, backupId, localPath) {
    try {
      // If backupId is a storage path, use it directly; otherwise construct path
      const storageKey = backupId.startsWith('backups/') ? backupId : `backups/${backupId}`;
      
      const downloadUrl = `${this.conductorUrl}/api/services/storage_manager/api/projects/${projectId}/buckets/${this.backupBucketName}/files/${storageKey}`;

      const response = await axios.get(downloadUrl, {
        headers: {
          'Authorization': `Bearer ${this.serviceToken}`
        },
        responseType: 'stream',
        timeout: 300000 // 5 minutes for large backups
      });

      // Write stream to file
      const writer = fs.createWriteStream(localPath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
    } catch (error) {
      logger.error(`[BackupService] Error downloading backup from storage_manager:`, error);
      throw new Error(`Failed to download backup from storage: ${error.message}`);
    }
  }

  /**
   * Ensure backup bucket exists in storage_manager
   * @param {string} projectId - Project ID
   * @returns {Promise<void>}
   */
  async ensureBackupBucket(projectId) {
    try {
      const bucketUrl = `${this.conductorUrl}/api/services/storage_manager/api/projects/${projectId}/buckets/${this.backupBucketName}`;
      
      // Try to get bucket first
      try {
        await axios.get(bucketUrl, {
          headers: {
            'Authorization': `Bearer ${this.serviceToken}`
          }
        });
        logger.info(`[BackupService] Backup bucket '${this.backupBucketName}' already exists`);
        return;
      } catch (error) {
        if (error.response?.status !== 404) {
          throw error;
        }
      }

      // Create bucket if it doesn't exist
      await axios.post(`${this.conductorUrl}/api/services/storage_manager/api/projects/${projectId}/buckets`, {
        name: this.backupBucketName,
        metadata: {
          purpose: 'database_backups',
          created_by: 'db_manager'
        }
      }, {
        headers: {
          'Authorization': `Bearer ${this.serviceToken}`,
          'Content-Type': 'application/json'
        }
      });

      logger.info(`[BackupService] Created backup bucket '${this.backupBucketName}'`);
    } catch (error) {
      logger.warn(`[BackupService] Could not ensure backup bucket exists: ${error.message}`);
      // Don't throw - backups can still work locally
    }
  }

  /**
   * Get database handler for type
   * @param {string} type - Database type
   * @returns {object} Database handler
   */
  getDatabaseHandler(type) {
    try {
      const handlerMap = {
        postgresql: require('./databases/postgresql'),
        mongodb: require('./databases/mongodb'),
        neo4j: require('./databases/neo4j'),
        elasticsearch: require('./databases/elasticsearch'),
        redis: require('./databases/redis')
      };
      return handlerMap[type] ? new handlerMap[type]() : null;
    } catch (error) {
      logger.warn(`[BackupService] Could not load handler for ${type}: ${error.message}`);
      return null;
    }
  }

  /**
   * Get backup file extension for database type
   * @param {string} type - Database type
   * @returns {string} File extension
   */
  getBackupExtension(type) {
    const extensions = {
      postgresql: 'sql.gz',
      mongodb: 'archive.gz',
      neo4j: 'dump.gz',
      elasticsearch: 'snapshot.tar.gz',
      redis: 'rdb.gz'
    };
    return extensions[type] || 'backup.gz';
  }
}

module.exports = BackupService;

