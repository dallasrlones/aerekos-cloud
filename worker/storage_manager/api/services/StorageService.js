const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Readable, Transform, pipeline } = require('stream');
const { promisify } = require('util');
const FileRepository = require('../repos/FileRepository');
const BucketRepository = require('../repos/BucketRepository');
const EncryptionService = require('./EncryptionService');
const logger = require('../utils/logger');

const pipelineAsync = promisify(pipeline);

class StorageService {
  constructor(conductorUrl, serviceToken) {
    this.fileRepo = new FileRepository();
    this.bucketRepo = new BucketRepository();
    this.encryptionService = new EncryptionService(conductorUrl, serviceToken);
    this.storagePath = process.env.STORAGE_PATH || './storage';
  }
  
  /**
   * Ensure storage directory exists
   */
  async ensureStorageDir() {
    try {
      await fs.access(this.storagePath);
    } catch {
      await fs.mkdir(this.storagePath, { recursive: true });
    }
  }
  
  /**
   * Physical base dir for a bucket. System buckets may override via base_path
   * (e.g. /mnt/usb24tb/aerekos-media) so data lands on a specific disk.
   */
  getBucketBase(bucket) {
    return (bucket && bucket.base_path) || this.storagePath;
  }
  
  /**
   * Get storage path for a file
   */
  getStoragePath(bucket, fileId, key) {
    // Create a safe filename from key
    const safeKey = key.replace(/[^a-zA-Z0-9._-]/g, '_');
    return path.join(this.getBucketBase(bucket), bucket.id, `${fileId}_${safeKey}`);
  }
  
  /**
   * Resolve a bucket by project+name or system+name (system takes precedence)
   */
  async _resolveBucket({ projectId = null, systemId = null, name }) {
    if (systemId) {
      const bucket = await this.bucketRepo.findBySystemAndName(systemId, name);
      if (!bucket) {
        throw new Error(`Bucket '${name}' not found in system '${systemId}'`);
      }
      return bucket;
    }
    const bucket = await this.bucketRepo.findByProjectAndName(projectId, name);
    if (!bucket) {
      throw new Error(`Bucket '${name}' not found in project '${projectId}'`);
    }
    // CRITICAL: Double-check ownership only when the bucket claims a project.
    // (System buckets / mocks may carry a null project_id.)
    if (bucket.project_id && bucket.project_id !== projectId) {
      throw new Error(`Bucket '${name}' does not belong to project '${projectId}'`);
    }
    return bucket;
  }
  
  /**
   * Upload a file (encrypted)
   * @param {string} projectId - Project ID
   * @param {string} bucketName - Bucket name
   * @param {string} key - File key/path
   * @param {Stream} fileStream - Readable stream of file data
   * @param {object} metadata - File metadata
   * @param {string} [existingFileId] - Optional existing file ID (for updating placeholder records)
   */
  async uploadFile(projectId, bucketName, key, fileStream, metadata = {}, existingFileId = null, systemId = null) {
    if (projectId) {
      try {
        const { assertQuota } = require('../../../shared/quotaGate');
        await assertQuota(projectId, 'storage_bytes');
      } catch (e) {
        if (e.status === 429) throw e;
      }
    }
    // CRITICAL: Validate inputs (either projectId or systemId must be provided)
    if ((!projectId && !systemId) || !bucketName || !key) {
      throw new Error('Missing required parameters: projectId (or systemId), bucketName, and key are required');
    }
    
    await this.ensureStorageDir();
    
    // Get bucket (project-scoped or system-scoped)
    const bucket = await this._resolveBucket({ projectId, systemId, name: bucketName });
    
    // If existingFileId is provided, find the placeholder record by ID
    // Otherwise, check if file already exists by bucket and key
    let existing = null;
    let fileId;
    
    if (existingFileId) {
      // Find placeholder record by ID
      existing = await this.fileRepo.findById(existingFileId);
      if (existing && existing.bucket_id === bucket.id && existing.key === key) {
        fileId = existingFileId;
      } else {
        // Placeholder doesn't match - treat as new file
        existing = null;
        fileId = crypto.randomUUID();
      }
    } else {
      // Check if file already exists by bucket and key
      existing = await this.fileRepo.findByBucketAndKey(bucket.id, key);
      fileId = existing ? existing.id : crypto.randomUUID();
    }
    
    const storagePath = this.getStoragePath(bucket, fileId, key);
    
    // Ensure bucket directory exists
    const bucketDir = path.dirname(storagePath);
    await fs.mkdir(bucketDir, { recursive: true });
    
    // Stream file directly: input -> hash (for ETag) -> encrypt -> disk
    // No memory buffering - pure streaming
    const hash = crypto.createHash('md5');
    let totalSize = 0;
    
    // Create transform stream to calculate size and hash while streaming
    const hashTransform = new Transform({
      transform(chunk, encoding, callback) {
        totalSize += chunk.length;
        hash.update(chunk);
        callback(null, chunk); // Pass through unchanged
      }
    });
    
    // Get encryption transform stream (it's a Transform, not a wrapper)
    const encryptionTransform = await this.encryptionService.encryptStream(
      fileStream,
      bucket.encryption_key_name,
      projectId // Pass projectId for project-scoped key lookup
    );
    
    // Create write stream to disk
    const writeStream = fsSync.createWriteStream(storagePath);
    
    // Pipe: fileStream -> hashTransform -> encryptionTransform -> writeStream
    // All streaming, no buffering
    // Note: encryptStream returns a Transform that wraps the input, so we pipe fileStream through it
    await pipelineAsync(
      fileStream,
      hashTransform,
      encryptionTransform,
      writeStream
    );
    
    // Generate ETag from hash
    const etag = hash.digest('hex');
    
    if (existing && existing.storage_path && existing.storage_path !== storagePath) {
      try {
        const versionDir = path.join(this.getBucketBase(bucket), bucket.id, 'versions', existing.id);
        await fs.mkdir(versionDir, { recursive: true });
        await fs.copyFile(existing.storage_path, path.join(versionDir, `${existing.etag || 'prev'}`));
      } catch (e) {
        logger.warn(`[StorageService] version snapshot skipped: ${e.message}`);
      }
    }
    // Update existing file record if it exists (placeholder from signed URL), otherwise create new one
    let file;
    if (existing) {
      // Update existing record (placeholder or existing file)
      file = await this.fileRepo.update(existing.id, {
        size: totalSize,
        content_type: metadata.content_type || 'application/octet-stream',
        etag,
        encryption_key_version: 1,
        storage_path: storagePath, // CRITICAL: Update storage_path from pending_* to actual path
        chunk_count: 1,
        chunk_size: totalSize,
        upload_id: null,
        upload_status: 'completed',
        metadata: JSON.stringify(metadata),
        updated_at: new Date().toISOString()
      });
      logger.info(`[StorageService] Updated file record ${existing.id} with storage_path: ${storagePath}`);
    } else {
      // Create new file record
      file = await this.fileRepo.create({
        bucket_id: bucket.id,
        key,
        size: totalSize,
        content_type: metadata.content_type || 'application/octet-stream',
        etag,
        encryption_key_version: 1,
        storage_path: storagePath,
        chunk_count: 1,
        chunk_size: totalSize,
        upload_id: null,
        upload_status: 'completed',
        metadata: JSON.stringify(metadata)
      });
    }
    
    logger.info(`[StorageService] Uploaded file: ${key} to bucket ${bucketName} (${totalSize} bytes)`);
    
    return {
      id: file.id,
      key: file.key,
      size: file.size,
      content_type: file.content_type,
      etag: file.etag,
      created_at: file.created_at
    };
  }
  
  /**
   * Download a file (decrypted)
   */
  async downloadFile(projectId, bucketName, key, systemId = null) {
    // Get bucket
    const bucket = await this._resolveBucket({ projectId, systemId, name: bucketName });
    
    // Get file record
    const file = await this.fileRepo.findByBucketAndKey(bucket.id, key);
    if (!file) {
      throw new Error(`File '${key}' not found in bucket '${bucketName}'`);
    }
    
    // Read encrypted file
    const encryptedBuffer = await fs.readFile(file.storage_path);
    
    // Decrypt file
    const decryptedBuffer = await this.encryptionService.decryptBuffer(
      encryptedBuffer,
      bucket.encryption_key_name,
      projectId, // Pass projectId for project-scoped key lookup
      file.encryption_key_version
    );
    
    // Log access
    await this.fileRepo.logAccess(file.id, {
      service_name: 'storage_manager',
      action: 'download',
      ip_address: 'unknown',
      success: 1
    });
    
    // Create readable stream from decrypted buffer
    const stream = Readable.from(decryptedBuffer);
    
    return {
      stream,
      size: file.size,
      content_type: file.content_type,
      etag: file.etag,
      metadata: file.metadata ? JSON.parse(file.metadata) : {}
    };
  }
  
  /**
   * Delete a file
   */
  async deleteFile(projectId, bucketName, key, systemId = null) {
    // Get bucket
    const bucket = await this._resolveBucket({ projectId, systemId, name: bucketName });
    
    // Get file record
    const file = await this.fileRepo.findByBucketAndKey(bucket.id, key);
    if (!file) {
      throw new Error(`File '${key}' not found in bucket '${bucketName}'`);
    }
    
    const meta = (() => { try { return JSON.parse(file.metadata || '{}'); } catch { return {}; } })();
    if (process.env.STORAGE_HARD_DELETE === '1') {
      try {
        await fs.unlink(file.storage_path);
      } catch (error) {
        logger.warn(`[StorageService] Failed to delete physical file: ${error.message}`);
      }
      await this.fileRepo.delete(file.id);
    } else {
      meta.deleted_at = new Date().toISOString();
      await this.fileRepo.update(file.id, { metadata: JSON.stringify(meta), upload_status: 'deleted' });
    }
    
    logger.info(`[StorageService] Deleted file: ${key} from bucket ${bucketName}`);
  }
  
  /**
   * List files in a bucket (S3-style with folders)
   * Returns files and folders separately for better navigation
   */
  async listFiles(projectId, bucketName, prefix = '', maxKeys = 1000, delimiter = '/', offset = 0, systemId = null) {
    // Get bucket
    const bucket = await this._resolveBucket({ projectId, systemId, name: bucketName });
    
    // Get more files to account for folders and pagination
    const fetchLimit = Math.max(maxKeys * 2, maxKeys + offset);
    const files = await this.fileRepo.findByBucket(bucket.id, {
      prefix,
      maxKeys: fetchLimit,
      offset
    });
    
    // Parse files and folders
    const fileList = [];
    const folderSet = new Set();
    const prefixLength = prefix.length;
    
    files.forEach(file => {
      const key = file.key;
      const relativeKey = key.substring(prefixLength);
      
      // Check if this is a file or folder
      if (delimiter && relativeKey.includes(delimiter)) {
        // This is inside a folder - extract folder name
        const folderName = relativeKey.split(delimiter)[0] + delimiter;
        if (!folderSet.has(folderName)) {
          folderSet.add(folderName);
        }
      } else {
        // This is a file at the current level
        fileList.push({
          key: key,
          name: relativeKey,
          size: file.size,
          content_type: file.content_type,
          etag: file.etag,
          last_modified: file.updated_at,
          metadata: file.metadata ? JSON.parse(file.metadata) : {}
        });
      }
    });
    
    // Convert folder set to sorted array
    const folders = Array.from(folderSet).sort().map(folderName => ({
      name: folderName,
      prefix: prefix + folderName,
      key: prefix + folderName
    }));
    
    // Combine folders and files, then sort (folders first, then files)
    const allItems = folders.concat(fileList);
    const totalCount = allItems.length;
    
    // Apply pagination
    const paginatedItems = allItems.slice(offset, offset + maxKeys);
    const paginatedFolders = paginatedItems.filter(item => item.prefix !== undefined);
    const paginatedFiles = paginatedItems.filter(item => item.prefix === undefined);
    
    const hasMore = offset + maxKeys < totalCount;
    
    return {
      files: paginatedFiles,
      folders: paginatedFolders,
      prefix: prefix,
      delimiter: delimiter,
      count: paginatedItems.length,
      hasMore: hasMore
    };
  }
  
  /**
   * Get file metadata
   */
  async getFileMetadata(projectId, bucketName, key, systemId = null) {
    // Get bucket
    const bucket = await this._resolveBucket({ projectId, systemId, name: bucketName });
    
    // Get file record
    const file = await this.fileRepo.findByBucketAndKey(bucket.id, key);
    if (!file) {
      throw new Error(`File '${key}' not found in bucket '${bucketName}'`);
    }
    
    return {
      key: file.key,
      size: file.size,
      content_type: file.content_type,
      etag: file.etag,
      created_at: file.created_at,
      updated_at: file.updated_at,
      metadata: file.metadata ? JSON.parse(file.metadata) : {}
    };
  }
  
  /**
   * Copy a file
   */
  async copyFile(sourceProject, sourceBucket, sourceKey, destProject, destBucket, destKey) {
    // Download source file
    const source = await this.downloadFile(sourceProject, sourceBucket, sourceKey);
    
    // Upload to destination
    const result = await this.uploadFile(
      destProject,
      destBucket,
      destKey,
      source.stream,
      source.metadata
    );
    
    logger.info(`[StorageService] Copied file: ${sourceKey} -> ${destKey}`);
    return result;
  }
}

module.exports = StorageService;
