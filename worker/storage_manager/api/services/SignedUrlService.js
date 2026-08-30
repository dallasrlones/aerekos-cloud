const crypto = require('crypto');
const path = require('path');
const SignedUrlRepository = require('../repos/SignedUrlRepository');
const FileRepository = require('../repos/FileRepository');
const BucketRepository = require('../repos/BucketRepository');
const logger = require('../utils/logger');

class SignedUrlService {
  constructor(baseUrl) {
    this.signedUrlRepo = new SignedUrlRepository();
    this.fileRepo = new FileRepository();
    this.bucketRepo = new BucketRepository();
    // Public conductor origin for browser-reachable signed URLs. Never localhost.
    this.baseUrl = (
      process.env.PUBLIC_URL ||
      process.env.PUBLIC_API_URL ||
      process.env.EXPO_PUBLIC_API_URL ||
      baseUrl ||
      process.env.CONDUCTOR_URL ||
      ''
    ).replace(/\/$/, '');
    if (!this.baseUrl) {
      throw new Error('PUBLIC_URL or CONDUCTOR_URL is required for signed URLs (no localhost fallback)');
    }
    this.secretKey = process.env.SIGNED_URL_SECRET || 'change-this-secret-key-in-production';
    if (process.env.NODE_ENV === 'production' && (!process.env.SIGNED_URL_SECRET || this.secretKey === 'change-this-secret-key-in-production')) {
      throw new Error('SIGNED_URL_SECRET must be set to a non-dummy value when NODE_ENV=production');
    }
  }
  
  /**
   * Generate a signed URL
   */
  generateSignedUrl(fileId, bucketId, urlType, ttlSeconds = 3600) {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const timestamp = Math.floor(Date.now() / 1000);
    
    // Ensure all values are strings for consistent HMAC calculation
    const fileIdStr = String(fileId);
    const bucketIdStr = String(bucketId);
    const urlTypeStr = String(urlType);
    const timestampStr = String(timestamp);
    const ttlStr = String(ttlSeconds);
    
    // Create signature
    const signature = crypto
      .createHmac('sha256', this.secretKey)
      .update(`${fileIdStr}:${bucketIdStr}:${urlTypeStr}:${timestampStr}:${ttlStr}`)
      .digest('hex');
    
    // Create URL - use storage_manager service path
    const url = `${this.baseUrl}/api/services/storage_manager/signed/${signature}/${fileId}/${bucketId}/${urlType}?expires=${timestamp}&ttl=${ttlSeconds}`;
    
    return {
      url,
      expires_at: expiresAt.toISOString(),
      signature,
      timestamp
    };
  }
  
  /**
   * Generate signed upload URL
   */
  async generateSignedUploadUrl(projectId, bucketName, key, ttlSeconds = 3600, metadata = {}) {
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
    
    // Check if file exists (for update) or create placeholder
    let file = await this.fileRepo.findByBucketAndKey(bucket.id, key);
    
    if (!file) {
      // Create placeholder file record with temporary storage path
      // The storage_path will be updated when the actual upload happens
      const fileId = crypto.randomUUID();
      const storagePath = path.join(
        process.env.STORAGE_PATH || './storage',
        bucket.id,
        `pending_${fileId}_${key.replace(/\//g, '_')}`
      );
      
      try {
        file = await this.fileRepo.create({
          bucket_id: bucket.id,
          key,
          size: 0,
          content_type: metadata.content_type || 'application/octet-stream',
          etag: null,
          encryption_key_version: 1,
          storage_path: storagePath, // Temporary path, will be updated on upload
          chunk_count: 0,
          chunk_size: 0,
          upload_id: null,
          upload_status: 'pending',
          metadata: JSON.stringify(metadata)
        });
      } catch (createError) {
        // Handle race condition: file might have been created by another request
        if (createError.message && createError.message.includes('UNIQUE constraint')) {
          // File was created by another request, fetch it
          logger.warn(`[SignedUrlService] File already exists (race condition), fetching: ${key}`);
          file = await this.fileRepo.findByBucketAndKey(bucket.id, key);
          if (!file) {
            throw new Error(`Failed to create or find file record: ${createError.message}`);
          }
        } else {
          throw createError;
        }
      }
    }
    
    const signedUrlData = this.generateSignedUrl(file.id, bucket.id, 'upload', ttlSeconds);
    
    // Store signed URL record
    await this.signedUrlRepo.create({
      file_id: file.id,
      bucket_id: bucket.id,
      url_type: 'upload',
      url: signedUrlData.url,
      expires_at: signedUrlData.expires_at,
      used: 0,
      used_at: null,
      metadata: JSON.stringify(metadata)
    });
    
    logger.info(`[SignedUrlService] Generated signed upload URL for: ${key}`);
    
    return {
      url: signedUrlData.url,
      expires_at: signedUrlData.expires_at,
      file_id: file.id
    };
  }
  
  /**
   * Generate signed download URL
   */
  async generateSignedDownloadUrl(projectId, bucketName, key, ttlSeconds = 3600) {
    // Get bucket
    const bucket = await this.bucketRepo.findByProjectAndName(projectId, bucketName);
    if (!bucket) {
      throw new Error(`Bucket '${bucketName}' not found in project`);
    }
    
    // Get file
    const file = await this.fileRepo.findByBucketAndKey(bucket.id, key);
    if (!file) {
      throw new Error(`File '${key}' not found in bucket '${bucketName}'`);
    }
    
    const signedUrlData = this.generateSignedUrl(file.id, bucket.id, 'download', ttlSeconds);
    
    // Store signed URL record
    await this.signedUrlRepo.create({
      file_id: file.id,
      bucket_id: bucket.id,
      url_type: 'download',
      url: signedUrlData.url,
      expires_at: signedUrlData.expires_at,
      used: 0,
      used_at: null,
      metadata: JSON.stringify({})
    });
    
    logger.info(`[SignedUrlService] Generated signed download URL for: ${key}`);
    
    return {
      url: signedUrlData.url,
      expires_at: signedUrlData.expires_at,
      file_id: file.id
    };
  }
  
  /**
   * Validate signed URL
   */
  async validateSignedUrl(signature, fileId, bucketId, urlType, timestamp, ttl) {
    // Ensure all values are strings for consistent HMAC calculation
    const fileIdStr = String(fileId);
    const bucketIdStr = String(bucketId);
    const urlTypeStr = String(urlType);
    const timestampStr = String(timestamp);
    const ttlStr = String(ttl);
    
    // Verify signature - must match exactly how it was generated
    const expectedSignature = crypto
      .createHmac('sha256', this.secretKey)
      .update(`${fileIdStr}:${bucketIdStr}:${urlTypeStr}:${timestampStr}:${ttlStr}`)
      .digest('hex');
    
    if (signature !== expectedSignature) {
      logger.error(`[SignedUrlService] Signature mismatch. Expected: ${expectedSignature.substring(0, 16)}..., Got: ${signature.substring(0, 16)}...`);
      logger.error(`[SignedUrlService] Validation params: fileId=${fileIdStr}, bucketId=${bucketIdStr}, urlType=${urlTypeStr}, timestamp=${timestampStr}, ttl=${ttlStr}`);
      throw new Error('Invalid signature');
    }
    
    // Check expiration
    const expiresAt = new Date(parseInt(timestamp) * 1000 + parseInt(ttl) * 1000);
    if (new Date() > expiresAt) {
      throw new Error('URL has expired');
    }
    
    // Check if URL was already used
    const signedUrl = await this.signedUrlRepo.findByUrl(
      `${this.baseUrl}/api/services/storage_manager/signed/${signature}/${fileId}/${bucketId}/${urlType}?expires=${timestamp}&ttl=${ttl}`
    );
    
    if (signedUrl && signedUrl.used === 1) {
      throw new Error('URL has already been used');
    }
    
    return {
      valid: true,
      file_id: fileId,
      bucket_id: bucketId,
      url_type: urlType,
      signed_url_record: signedUrl
    };
  }
  
  /**
   * Mark signed URL as used
   */
  async markUrlAsUsed(signedUrlId) {
    await this.signedUrlRepo.update(signedUrlId, {
      used: 1,
      used_at: new Date().toISOString()
    });
  }
  
  /**
   * Revoke signed URL
   */
  async revokeSignedUrl(signedUrlId) {
    await this.signedUrlRepo.delete(signedUrlId);
    logger.info(`[SignedUrlService] Revoked signed URL: ${signedUrlId}`);
  }
  
  /**
   * List signed URLs for a bucket
   */
  async listSignedUrls(projectId, bucketName, filter = {}) {
    // Get bucket
    const bucket = await this.bucketRepo.findByProjectAndName(projectId, bucketName);
    if (!bucket) {
      throw new Error(`Bucket '${bucketName}' not found in project`);
    }
    
    const signedUrls = await this.signedUrlRepo.findByBucket(bucket.id, filter);
    
    return signedUrls.map(url => ({
      id: url.id,
      file_id: url.file_id,
      url_type: url.url_type,
      url: url.url,
      expires_at: url.expires_at,
      used: url.used === 1,
      used_at: url.used_at,
      created_at: url.created_at
    }));
  }
  
  /**
   * Cleanup expired signed URLs
   */
  async cleanupExpiredUrls() {
    const expiredUrls = await this.signedUrlRepo.findExpired();
    
    for (const url of expiredUrls) {
      await this.signedUrlRepo.delete(url.id);
    }
    
    logger.info(`[SignedUrlService] Cleaned up ${expiredUrls.length} expired signed URLs`);
    
    return expiredUrls.length;
  }
}

module.exports = SignedUrlService;
