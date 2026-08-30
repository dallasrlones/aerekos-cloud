const BucketRepository = require('../repos/BucketRepository');
const FileRepository = require('../repos/FileRepository');
const ProjectRepository = require('../repos/ProjectRepository');
const logger = require('../utils/logger');
const crypto = require('crypto');
const axios = require('axios');

class BucketService {
  constructor(conductorUrl = null, serviceToken = null) {
    this.bucketRepo = new BucketRepository();
    this.fileRepo = new FileRepository();
    this.projectRepo = new ProjectRepository();
    // Optional overrides (e.g. conductor registration). Env is read at call time so instances
    // created before dotenv/setup still see CONDUCTOR_URL / SERVICE_TOKEN when set later.
    this._conductorUrl = conductorUrl || null;
    this._serviceToken = serviceToken || null;
  }

  _resolveConductorUrl() {
    return this._conductorUrl || process.env.CONDUCTOR_URL || null;
  }

  _resolveServiceToken() {
    return this._serviceToken || process.env.SERVICE_TOKEN || null;
  }
  
  /**
   * Ensure encryption key exists in key_manager
   * Creates key if it doesn't exist
   */
  async ensureEncryptionKey(keyName, projectId = null) {
    if (process.env.MOCK_KEY_MANAGER === 'true') {
      return;
    }

    const conductorUrl = this._resolveConductorUrl();
    const serviceToken = this._resolveServiceToken();

    if (!conductorUrl) {
      throw new Error('CONDUCTOR_URL not configured - cannot connect to key_manager');
    }

    if (!serviceToken) {
      throw new Error('Service token not available - cannot authenticate with key_manager');
    }
    
    // Extract projectId from keyName if not provided (format: bucket-{projectId}-{bucketName}-{random})
    if (!projectId && keyName.startsWith('bucket-')) {
      const parts = keyName.split('-');
      if (parts.length >= 2) {
        // Try to extract UUID (36 chars with dashes)
        const keyNameWithoutPrefix = keyName.substring(7); // Remove "bucket-"
        const uuidMatch = keyNameWithoutPrefix.match(/^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/);
        if (uuidMatch) {
          projectId = uuidMatch[1];
        }
      }
    }
    
    const headers = {
      'Authorization': `Bearer ${serviceToken}`,
      'Content-Type': 'application/json'
    };
    
    // Add projectId to header if available
    if (projectId) {
      headers['x-project-id'] = projectId;
    }
    
    try {
      // Check if key exists
      const url = projectId
        ? `${conductorUrl}/api/services/key_manager/api/keys/${keyName}?project_id=${projectId}`
        : `${conductorUrl}/api/services/key_manager/api/keys/${keyName}`;
      
      await axios.get(url, {
        headers,
        timeout: 5000
      });
      logger.info(`[BucketService] Encryption key '${keyName}' already exists`);
    } catch (error) {
      if (error.response?.status === 404) {
        // Create key if it doesn't exist
        try {
          const createUrl = projectId
            ? `${conductorUrl}/api/services/key_manager/api/keys?project_id=${projectId}`
            : `${conductorUrl}/api/services/key_manager/api/keys`;
          
          await axios.post(
            createUrl,
            {
              name: keyName,
              type: 'symmetric',
              algorithm: 'AES-256-GCM',
              metadata: {
                description: `Encryption key for storage bucket: ${keyName}`,
                created_by: 'storage_manager'
              }
            },
            {
              headers,
              timeout: 10000
            }
          );
          logger.info(`[BucketService] Created encryption key '${keyName}' in key_manager`);
        } catch (createError) {
          logger.error(`[BucketService] Failed to create encryption key '${keyName}':`, createError.message);
          throw new Error(`Failed to create encryption key: ${createError.message}`);
        }
      } else {
        logger.error(`[BucketService] Failed to check encryption key '${keyName}':`, error.message);
        throw new Error(`Failed to verify encryption key: ${error.message}`);
      }
    }
  }
  
  /**
   * Create a bucket in a project
   * Each bucket gets a unique encryption key from key_manager (HIPAA-compliant)
   */
  async createBucket(projectId, name, createdBy, encryptionKeyName = null, metadata = {}) {
    // Verify project exists
    await this.projectRepo.findById(projectId);
    
    // Check if bucket already exists in project
    const existing = await this.bucketRepo.findByProjectAndName(projectId, name);
    if (existing) {
      throw new Error(`Bucket '${name}' already exists in project`);
    }
    
    // Generate unique encryption key name for bucket (HIPAA-compliant: unique key per bucket)
    let uniqueKeyName;
    if (encryptionKeyName) {
      // Use provided key name (verify it exists)
      uniqueKeyName = encryptionKeyName;
      await this.ensureEncryptionKey(uniqueKeyName, projectId);
    } else {
      // Generate unique key name: bucket-{projectId}-{bucketName}-{random}
      const bucketId = crypto.randomUUID();
      const sanitizedName = name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      uniqueKeyName = `bucket-${projectId}-${sanitizedName}-${bucketId.substring(0, 8)}`;
      
      // Ensure unique key exists in key_manager
      await this.ensureEncryptionKey(uniqueKeyName, projectId);
    }
    
    const bucket = await this.bucketRepo.create({
      project_id: projectId,
      name,
      created_by: createdBy,
      encryption_key_name: uniqueKeyName,
      metadata: JSON.stringify(metadata)
    });
    
    logger.info(`[BucketService] Created bucket: ${name} in project ${projectId} with encryption key: ${uniqueKeyName}`);
    return bucket;
  }
  
  /**
   * Get bucket by project and name
   */
  async getBucket(projectId, bucketName) {
    const bucket = await this.bucketRepo.findByProjectAndName(projectId, bucketName);
    if (!bucket) {
      throw new Error(`Bucket '${bucketName}' not found in project`);
    }
    
    if (bucket.metadata) {
      try {
        bucket.metadata = JSON.parse(bucket.metadata);
      } catch (e) {
        // Keep as string if not valid JSON
      }
    }
    
    return bucket;
  }
  
  /**
   * List buckets in a project
   */
  async listBuckets(projectId, filter = {}) {
    // Verify project exists
    await this.projectRepo.findById(projectId);
    
    const buckets = await this.bucketRepo.findByProject(projectId, filter);
    
    // Parse metadata JSON
    return buckets.map(bucket => {
      if (bucket.metadata) {
        try {
          bucket.metadata = JSON.parse(bucket.metadata);
        } catch (e) {
          // Keep as string if not valid JSON
        }
      }
      return bucket;
    });
  }
  
  /**
   * Update bucket settings
   */
  async updateBucket(projectId, bucketName, updates) {
    const bucket = await this.getBucket(projectId, bucketName);
    
    const updateData = {};
    if (updates.encryption_key_name) updateData.encryption_key_name = updates.encryption_key_name;
    if (updates.metadata) {
      updateData.metadata = typeof updates.metadata === 'string' 
        ? updates.metadata 
        : JSON.stringify(updates.metadata);
    }
    
    return await this.bucketRepo.update(bucket.id, updateData);
  }

  /**
   * Find all buckets using a specific encryption key
   */
  async findBucketsByEncryptionKey(encryptionKeyName) {
    return await this.bucketRepo.findByEncryptionKey(encryptionKeyName);
  }

  /**
   * Update all buckets using old key to use new key
   */
  async replaceEncryptionKey(oldKeyName, newKeyName) {
    const buckets = await this.bucketRepo.findByEncryptionKey(oldKeyName);
    
    for (const bucket of buckets) {
      await this.bucketRepo.update(bucket.id, {
        encryption_key_name: newKeyName
      });
    }
    
    return buckets.length;
  }
  
  /**
   * Delete bucket and all its files
   * Also deletes the encryption key from key_manager if no other buckets are using it
   */
  async deleteBucket(projectId, bucketName) {
    const bucket = await this.getBucket(projectId, bucketName);
    const encryptionKeyName = bucket.encryption_key_name;
    
    // Get all files in the bucket
    const files = await this.fileRepo.findByBucket(bucket.id, { maxKeys: 10000 }); // Get all files
    
    // Delete all files (both database records and physical files)
    const fs = require('fs').promises;
    const path = require('path');
    
    for (const file of files) {
      try {
        // Delete physical file if it exists
        if (file.storage_path) {
          try {
            await fs.unlink(file.storage_path);
          } catch (error) {
            // File might already be deleted, continue
            logger.warn(`[BucketService] Failed to delete physical file ${file.storage_path}: ${error.message}`);
          }
        }
        
        // Delete file record from database
        await this.fileRepo.delete(file.id);
      } catch (error) {
        logger.error(`[BucketService] Failed to delete file ${file.key}: ${error.message}`);
        // Continue deleting other files even if one fails
      }
    }
    
    // Delete bucket directory if it exists
    const bucketDir = path.join(process.env.STORAGE_PATH || './storage', bucket.id);
    try {
      await fs.rm(bucketDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist or already deleted, continue
      logger.warn(`[BucketService] Failed to delete bucket directory ${bucketDir}: ${error.message}`);
    }
    
    // Delete bucket record
    await this.bucketRepo.delete(bucket.id);
    
    // Check if any other buckets are using this encryption key
    // If not, delete the key from key_manager
    if (encryptionKeyName) {
      const bucketsUsingKey = await this.bucketRepo.findByEncryptionKey(encryptionKeyName);

      if (bucketsUsingKey.length === 0) {
        // No other buckets are using this key, safe to delete
        if (process.env.MOCK_KEY_MANAGER === 'true') {
          logger.debug(`[BucketService] MOCK_KEY_MANAGER: skip key_manager delete for '${encryptionKeyName}'`);
        } else {
          try {
            const conductorUrl = this._resolveConductorUrl();
            const serviceToken = this._resolveServiceToken();
            if (conductorUrl && serviceToken) {
              await axios.delete(
                `${conductorUrl}/api/services/key_manager/api/keys/${encryptionKeyName}?project_id=${projectId}`,
                {
                  headers: {
                    'Authorization': `Bearer ${serviceToken}`,
                    'Content-Type': 'application/json'
                  },
                  timeout: 5000
                }
              );
              logger.info(`[BucketService] Deleted encryption key '${encryptionKeyName}' from key_manager (no other buckets using it)`);
            } else {
              logger.warn(`[BucketService] Cannot delete encryption key '${encryptionKeyName}': conductor URL or service token not configured`);
            }
          } catch (error) {
            // Log error but don't fail bucket deletion if key deletion fails
            logger.warn(`[BucketService] Failed to delete encryption key '${encryptionKeyName}' from key_manager: ${error.message}`);
          }
        }
      } else {
        logger.info(`[BucketService] Keeping encryption key '${encryptionKeyName}' in key_manager (used by ${bucketsUsingKey.length} other bucket(s))`);
      }
    }
    
    logger.info(`[BucketService] Deleted bucket: ${bucketName} from project ${projectId} (deleted ${files.length} file(s))`);
  }
}

module.exports = BucketService;
