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
const DecryptingStream = require('./DecryptingStream');

const pipelineAsync = promisify(pipeline);

/**
 * Parse an HTTP Range header (single absolute or suffix range).
 * Returns {start, end} (both inclusive) or null if malformed/unsatisfiable.
 */
function parseByteRange(header, totalSize) {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/i.exec(String(header).trim());
  if (!m) return null;
  if (m[1] === '' && m[2] === '') return null;
  let start;
  let end;
  if (m[1] === '') {
    // Suffix range: last N bytes
    const suffix = parseInt(m[2], 10);
    if (suffix <= 0) return null;
    start = Math.max(0, totalSize - suffix);
    end = totalSize - 1;
  } else {
    start = parseInt(m[1], 10);
    end = m[2] === '' ? totalSize - 1 : Math.min(parseInt(m[2], 10), totalSize - 1);
    if (start >= totalSize) return null;
  }
  return { start, end };
}

/**
 * Read exactly `length` bytes at `offset` from a file, failing on a short
 * read (used to pull the 16-byte IV header from a stored object).
 */
async function readFixedBytes(filePath, offset, length) {
  const handle = await fs.open(filePath);
  try {
    const buf = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buf, 0, length, offset);
    if (bytesRead < length) {
      throw new Error(`Short read on ${filePath}: got ${bytesRead} of ${length} bytes at offset ${offset}`);
    }
    return buf;
  } finally {
    await handle.close();
  }
}

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
   * Download a file (decrypted), streamed in bounded memory.
   *
   * The stored object is decrypted on the fly by DecryptingStream (8 MiB
   * chunks): the OpenSSL GCM limit on a single update() call (2 GiB) no
   * longer applies, and a Range request reads only the ciphertext window it
   * serves — so objects of any size (e.g. a 20 GiB movie) stream without
   * buffering the whole file.
   *
   * Pass an HTTP Range header (e.g. 'bytes=100-199') to get a partial
   * result: the stream contains only the range, `size` is the slice length,
   * `contentRange` is the 'bytes a-b/total' header value and `totalSize` is
   * the full file size.
   */
  async downloadFile(projectId, bucketName, key, systemId = null, rangeHeader = null) {
    // Get bucket
    const bucket = await this._resolveBucket({ projectId, systemId, name: bucketName });
    
    // Get file record
    const file = await this.fileRepo.findByBucketAndKey(bucket.id, key);
    if (!file) {
      throw new Error(`File '${key}' not found in bucket '${bucketName}'`);
    }
    
    // Stat the stored object up front: size drives Range handling and a
    // missing/corrupt object fails fast before any streaming.
    let stat;
    try {
      stat = await fs.stat(file.storage_path);
    } catch (err) {
      throw new Error(`Stored object missing: ${file.storage_path}`);
    }
    if (stat.size < 32) {
      throw new Error(`Stored object too small to be valid (${stat.size} bytes): ${file.storage_path}`);
    }
    
    // On-disk layout: IV (16) || ciphertext (size-32) || auth tag (16).
    // GCM is a stream cipher, so plaintext length === ciphertext length.
    const iv = await readFixedBytes(file.storage_path, 0, 16);
    const ctLen = stat.size - 32;
    const totalSize = ctLen;
    
    let start = 0;
    let end = totalSize - 1;
    let contentRange = null;
    if (rangeHeader) {
      const range = parseByteRange(rangeHeader, totalSize);
      if (!range) {
        throw Object.assign(new Error('Range not satisfiable'), { status: 416 });
      }
      start = range.start;
      end = range.end;
      contentRange = `bytes ${start}-${end}/${totalSize}`;
    }
    
    const keyBuffer = await this.encryptionService.getKeyBuffer(
      bucket.encryption_key_name,
      projectId // projectId for project-scoped key lookup
    );
    
    let stream;
    if (end < start) {
      // Degenerate range (e.g. bytes=100-50): serve an empty body.
      stream = Readable.from([]);
    } else {
      stream = new DecryptingStream({
        filePath: file.storage_path,
        iv,
        keyBuffer,
        ctLen,
        start,
        end,
        // The GCM auth tag authenticates the whole ciphertext, so it is only
        // verifiable when the entire ciphertext is processed. Range reads
        // skip the check (standard trade-off for ranged reads of
        // server-side-encrypted objects).
        verifyTag: start === 0 && end === totalSize - 1
      });
    }
    
    // Log access
    await this.fileRepo.logAccess(file.id, {
      service_name: 'storage_manager',
      action: 'download',
      ip_address: 'unknown',
      success: 1
    });
    
    return {
      stream,
      size: end < start ? 0 : end - start + 1,
      content_type: file.content_type,
      etag: file.etag,
      metadata: file.metadata ? JSON.parse(file.metadata) : {},
      contentRange,
      totalSize
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
    
    // The SQL already applied `offset` to the raw rows — do NOT slice by
    // `offset` again. The old code double-applied it: with 2365 rows,
    // maxKeys=1000, offset=1000 it fetched rows 1000-2364 (1365) and then
    // slice(1000, 2000) returned only rows 2000-2364, dropping rows
    // 1000-1999 (1000 files) from every paged listing.
    //
    // A "full" batch (we hit fetchLimit) means more raw rows exist, so cap
    // this page at maxKeys and say hasMore. A partial batch is the end:
    // return the WHOLE batch (even if it exceeds maxKeys) and stop.
    const fullBatch = files.length >= fetchLimit;
    const paginatedItems = allItems.slice(0, fullBatch ? maxKeys : allItems.length);
    const paginatedFolders = paginatedItems.filter(item => item.prefix !== undefined);
    const paginatedFiles = paginatedItems.filter(item => item.prefix === undefined);

    const hasMore = fullBatch;
    
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
