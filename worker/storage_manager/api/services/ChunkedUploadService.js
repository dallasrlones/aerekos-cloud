const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { Readable } = require('stream');
const FileRepository = require('../repos/FileRepository');
const FileChunkRepository = require('../repos/FileChunkRepository');
const BucketRepository = require('../repos/BucketRepository');
const EncryptionService = require('./EncryptionService');
const logger = require('../utils/logger');

class ChunkedUploadService {
  constructor(conductorUrl, serviceToken) {
    this.fileRepo = new FileRepository();
    this.chunkRepo = new FileChunkRepository();
    this.bucketRepo = new BucketRepository();
    this.encryptionService = new EncryptionService(conductorUrl, serviceToken);
    this.storagePath = process.env.STORAGE_PATH || './storage';
  }
  
  /**
   * Initiate a chunked upload
   */
  async initiateChunkedUpload(projectId, bucketName, key, totalSize, chunkSize, metadata = {}) {
    // CRITICAL: Validate inputs
    if (!projectId || !bucketName || !key) {
      throw new Error('Missing required parameters: projectId, bucketName, and key are required');
    }
    
    // Get bucket - CRITICAL: This ensures bucket belongs to the specified project
    const bucket = await this.bucketRepo.findByProjectAndName(projectId, bucketName);
    if (!bucket) {
      throw new Error(`Bucket '${bucketName}' not found in project '${projectId}'`);
    }
    
    // CRITICAL: Double-check bucket belongs to project
    if (bucket.project_id !== projectId) {
      throw new Error(`Bucket '${bucketName}' does not belong to project '${projectId}'`);
    }
    
    const uploadId = crypto.randomUUID();
    const fileId = crypto.randomUUID();
    
    // Calculate number of chunks
    const chunkCount = Math.ceil(totalSize / chunkSize);
    
    // Create file record with pending status (storage_path required by model — placeholder until complete)
    const file = await this.fileRepo.create({
      bucket_id: bucket.id,
      key,
      size: totalSize,
      content_type: metadata.content_type || 'application/octet-stream',
      etag: null, // Will be set on completion
      encryption_key_version: 1,
      storage_path: `pending:${uploadId}`,
      chunk_count: chunkCount,
      chunk_size: chunkSize,
      upload_id: uploadId,
      upload_status: 'in_progress',
      metadata: JSON.stringify(metadata)
    });
    
    logger.info(`[ChunkedUploadService] Initiated chunked upload: ${key} (${chunkCount} chunks)`);
    
    return {
      upload_id: uploadId,
      file_id: file.id,
      chunk_count: chunkCount,
      chunk_size: chunkSize
    };
  }
  
  /**
   * Upload a single chunk
   */
  async uploadChunk(uploadId, chunkNumber, chunkData) {
    // Find file by upload_id
    const files = await this.fileRepo.findAll({ where: { upload_id: uploadId } });
    if (files.length === 0) {
      throw new Error(`Upload '${uploadId}' not found`);
    }
    
    const file = files[0];
    
    if (file.upload_status !== 'in_progress') {
      throw new Error(`Upload '${uploadId}' is not in progress`);
    }
    
    // Get bucket
    const bucket = await this.bucketRepo.findById(file.bucket_id);
    
    // Encrypt chunk
    const chunkBuffer = Buffer.isBuffer(chunkData) ? chunkData : Buffer.from(chunkData);
    const encryptedChunk = await this.encryptionService.encryptBuffer(
      chunkBuffer,
      bucket.encryption_key_name,
      bucket.project_id
    );
    
    // Generate ETag for chunk
    const etag = this.encryptionService.generateETag(chunkBuffer);
    
    // Store chunk
    const chunkPath = path.join(
      this.storagePath,
      bucket.id,
      file.id,
      `chunk_${chunkNumber}`
    );
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(chunkPath), { recursive: true });
    
    // Write encrypted chunk
    await fs.writeFile(chunkPath, encryptedChunk);
    
    // Create or update chunk record
    const existingChunk = await this.chunkRepo.findByFileAndNumber(file.id, chunkNumber);
    if (existingChunk) {
      await this.chunkRepo.update(existingChunk.id, {
        chunk_path: chunkPath,
        chunk_size: chunkBuffer.length,
        etag,
        upload_status: 'uploaded'
      });
    } else {
      await this.chunkRepo.create({
        file_id: file.id,
        chunk_number: chunkNumber,
        chunk_path: chunkPath,
        chunk_size: chunkBuffer.length,
        etag,
        upload_status: 'uploaded'
      });
    }
    
    logger.debug(`[ChunkedUploadService] Uploaded chunk ${chunkNumber} for upload ${uploadId}`);
    
    return {
      chunk_number: chunkNumber,
      etag,
      size: chunkBuffer.length
    };
  }
  
  /**
   * Complete chunked upload and merge chunks
   */
  async completeChunkedUpload(uploadId, chunkETags = []) {
    // Find file by upload_id
    const files = await this.fileRepo.findAll({ where: { upload_id: uploadId } });
    if (files.length === 0) {
      throw new Error(`Upload '${uploadId}' not found`);
    }
    
    const file = files[0];
    
    if (file.upload_status !== 'in_progress') {
      throw new Error(`Upload '${uploadId}' is not in progress`);
    }
    
    // Get all chunks
    const chunks = await this.chunkRepo.findByFile(file.id);
    
    if (chunks.length !== file.chunk_count) {
      throw new Error(`Expected ${file.chunk_count} chunks, got ${chunks.length}`);
    }
    
    // Verify ETags if provided
    if (chunkETags.length > 0 && chunkETags.length !== chunks.length) {
      throw new Error(`ETag count mismatch`);
    }
    
    // Get bucket
    const bucket = await this.bucketRepo.findById(file.bucket_id);
    
    // Merge chunks (use bucket.project_id for project-scoped key lookup)
    const mergedBuffer = await this.mergeChunks(file.id, chunks, bucket.encryption_key_name, bucket.project_id);
    
    // Generate final ETag (plaintext, matches streaming upload hash-before-encrypt)
    const finalETag = this.encryptionService.generateETag(mergedBuffer);

    const storagePath = this.getStoragePath(bucket.id, file.id, file.key);
    await fs.mkdir(path.dirname(storagePath), { recursive: true });
    const encryptedFinal = await this.encryptionService.encryptBuffer(
      mergedBuffer,
      bucket.encryption_key_name,
      bucket.project_id
    );
    await fs.writeFile(storagePath, encryptedFinal);
    
    // Update file record
    await this.fileRepo.update(file.id, {
      etag: finalETag,
      storage_path: storagePath,
      upload_status: 'completed'
    });
    
    // Clean up chunk files
    for (const chunk of chunks) {
      try {
        await fs.unlink(chunk.chunk_path);
      } catch (error) {
        logger.warn(`[ChunkedUploadService] Failed to delete chunk file: ${error.message}`);
      }
      await this.chunkRepo.delete(chunk.id);
    }
    
    logger.info(`[ChunkedUploadService] Completed chunked upload: ${file.key}`);
    
    return {
      file_id: file.id,
      key: file.key,
      size: file.size,
      etag: finalETag
    };
  }
  
  /**
   * Merge encrypted chunks into final file
   */
  async mergeChunks(fileId, chunks, encryptionKeyName, projectId) {
    const decryptedChunks = [];
    
    for (const chunk of chunks.sort((a, b) => a.chunk_number - b.chunk_number)) {
      // Read encrypted chunk
      const encryptedChunk = await fs.readFile(chunk.chunk_path);
      
      // Decrypt chunk
      const decryptedChunk = await this.encryptionService.decryptBuffer(
        encryptedChunk,
        encryptionKeyName,
        projectId // Pass projectId for project-scoped key lookup
      );
      
      decryptedChunks.push(decryptedChunk);
    }
    
    // Merge all chunks
    return Buffer.concat(decryptedChunks);
  }
  
  /**
   * Get storage path for a file
   */
  getStoragePath(bucketId, fileId, key) {
    const safeKey = key.replace(/[^a-zA-Z0-9._-]/g, '_');
    return path.join(this.storagePath, bucketId, `${fileId}_${safeKey}`);
  }
  
  /**
   * Abort chunked upload
   */
  async abortChunkedUpload(uploadId) {
    // Find file by upload_id
    const files = await this.fileRepo.findAll({ where: { upload_id: uploadId } });
    if (files.length === 0) {
      throw new Error(`Upload '${uploadId}' not found`);
    }
    
    const file = files[0];
    
    // Get all chunks
    const chunks = await this.chunkRepo.findByFile(file.id);
    
    // Delete chunk files
    for (const chunk of chunks) {
      try {
        await fs.unlink(chunk.chunk_path);
      } catch (error) {
        logger.warn(`[ChunkedUploadService] Failed to delete chunk file: ${error.message}`);
      }
      await this.chunkRepo.delete(chunk.id);
    }
    
    // Delete file record
    await this.fileRepo.delete(file.id);
    
    logger.info(`[ChunkedUploadService] Aborted chunked upload: ${uploadId}`);
  }
  
  /**
   * Get upload status
   */
  async getChunkedUploadStatus(uploadId) {
    // Find file by upload_id
    const files = await this.fileRepo.findAll({ where: { upload_id: uploadId } });
    if (files.length === 0) {
      throw new Error(`Upload '${uploadId}' not found`);
    }
    
    const file = files[0];
    
    // Get chunks
    const chunks = await this.chunkRepo.findByFile(file.id);
    const uploadedChunks = chunks.filter(c => c.upload_status === 'uploaded');
    
    return {
      upload_id: uploadId,
      file_id: file.id,
      key: file.key,
      status: file.upload_status,
      total_chunks: file.chunk_count,
      uploaded_chunks: uploadedChunks.length,
      progress: (uploadedChunks.length / file.chunk_count) * 100
    };
  }
}

module.exports = ChunkedUploadService;
