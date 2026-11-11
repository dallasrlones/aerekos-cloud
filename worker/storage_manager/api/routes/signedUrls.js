const express = require('express');
const SignedUrlService = require('../services/SignedUrlService');
const StorageService = require('../services/StorageService');
const validateServiceToken = require('../middleware/auth');
const { pipeStreamToResponse } = require('../utils/streamResponse');
const logger = require('../utils/logger');

const router = express.Router();

// Initialize services
const getSignedUrlService = () => {
  return new SignedUrlService(process.env.CONDUCTOR_URL);
};

const getStorageService = () => {
  return new StorageService(
    process.env.CONDUCTOR_URL,
    process.env.SERVICE_TOKEN
  );
};

// POST /api/projects/:projectId/buckets/:bucketName/files/:key/signed-url/upload - Generate signed upload URL
router.post('/:projectId/buckets/:bucketName/files/:key(*)/signed-url/upload', validateServiceToken, async (req, res, next) => {
  try {
    const { projectId, bucketName, key } = req.params;
    const { ttl_seconds = 3600, metadata = {} } = req.body;
    
    const signedUrlService = getSignedUrlService();
    const result = await signedUrlService.generateSignedUploadUrl(
      projectId,
      bucketName,
      key,
      parseInt(ttl_seconds),
      metadata
    );
    
    res.status(201).json(result);
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: { message: error.message, status: 404 }
      });
    }
    next(error);
  }
});

// POST /api/projects/:projectId/buckets/:bucketName/files/:key/signed-url/download - Generate signed download URL
router.post('/:projectId/buckets/:bucketName/files/:key(*)/signed-url/download', validateServiceToken, async (req, res, next) => {
  try {
    const { projectId, bucketName, key } = req.params;
    const { ttl_seconds = 3600 } = req.body;
    
    const signedUrlService = getSignedUrlService();
    const result = await signedUrlService.generateSignedDownloadUrl(
      projectId,
      bucketName,
      key,
      parseInt(ttl_seconds)
    );
    
    res.status(201).json(result);
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: { message: error.message, status: 404 }
      });
    }
    next(error);
  }
});

// GET /api/projects/:projectId/buckets/:bucketName/signed-urls - List signed URLs
router.get('/:projectId/buckets/:bucketName/signed-urls', validateServiceToken, async (req, res, next) => {
  try {
    const { projectId, bucketName } = req.params;
    
    const signedUrlService = getSignedUrlService();
    const signedUrls = await signedUrlService.listSignedUrls(projectId, bucketName);
    
    res.json({ signed_urls: signedUrls });
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: { message: error.message, status: 404 }
      });
    }
    next(error);
  }
});

// DELETE /api/signed-urls/:signedUrlId - Revoke signed URL
router.delete('/signed-urls/:signedUrlId', validateServiceToken, async (req, res, next) => {
  try {
    const { signedUrlId } = req.params;
    
    const signedUrlService = getSignedUrlService();
    await signedUrlService.revokeSignedUrl(signedUrlId);
    
    res.status(204).end();
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: { message: error.message, status: 404 }
      });
    }
    next(error);
  }
});

// GET /signed/:signature/:fileId/:bucketId/:urlType - Handle signed URL download requests
router.get('/signed/:signature/:fileId/:bucketId/:urlType', async (req, res, next) => {
  try {
    const { signature, fileId, bucketId, urlType } = req.params;
    const { expires, ttl } = req.query;
    
    if (!expires || !ttl) {
      return res.status(400).json({
        error: { message: 'Missing expires or ttl parameters', status: 400 }
      });
    }
    
    const signedUrlService = getSignedUrlService();
    
    // Ensure expires and ttl are strings (they come from query params as strings)
    const expiresStr = String(expires);
    const ttlStr = String(ttl);
    
    const validation = await signedUrlService.validateSignedUrl(
      signature,
      fileId,
      bucketId,
      urlType,
      expiresStr,
      ttlStr
    );
    
    // Mark URL as used. Upload URLs are one-shot; download URLs may be
    // re-requested (e.g. browser Range/seek requests against the same URL).
    if (validation.signed_url_record && urlType === 'upload') {
      await signedUrlService.markUrlAsUsed(validation.signed_url_record.id);
    }
    
    // Handle download
    if (urlType === 'download') {
      const FileRepository = require('../repos/FileRepository');
      const BucketRepository = require('../repos/BucketRepository');
      const ProjectRepository = require('../repos/ProjectRepository');
      
      const fileRepo = new FileRepository();
      const bucketRepo = new BucketRepository();
      const projectRepo = new ProjectRepository();
      
      const file = await fileRepo.findById(fileId);
      if (!file) {
        return res.status(404).json({
          error: { message: 'File not found', status: 404 }
        });
      }
      
      const bucket = await bucketRepo.findById(bucketId);
      if (!bucket) {
        return res.status(404).json({
          error: { message: 'Bucket not found', status: 404 }
        });
      }
      
      // Project buckets resolve through their project; system buckets
      // (project_id = null) resolve through their system.
      let projectId = null;
      let systemId = null;
      if (bucket.project_id) {
        const project = await projectRepo.findById(bucket.project_id);
        if (!project) {
          return res.status(404).json({
            error: { message: 'Project not found', status: 404 }
          });
        }
        projectId = project.id;
      } else {
        systemId = bucket.system_id;
      }
      
      const storageService = getStorageService();
      const fileData = await storageService.downloadFile(
        projectId,
        bucket.name,
        file.key,
        systemId,
        req.headers['range']
      );
      
      res.setHeader('Content-Type', fileData.content_type);
      res.setHeader('Content-Length', fileData.size);
      res.setHeader('ETag', fileData.etag);
      res.setHeader('Accept-Ranges', 'bytes');
      if (fileData.contentRange) {
        res.status(206);
        res.setHeader('Content-Range', fileData.contentRange);
      }
      
      // Stream the decrypted object to the client with abort/error
      // handling (see pipeStreamToResponse).
      pipeStreamToResponse(fileData.stream, res);
    } else if (urlType === 'upload') {
      // Handle upload via signed URL
      const FileRepository = require('../repos/FileRepository');
      const BucketRepository = require('../repos/BucketRepository');
      const ProjectRepository = require('../repos/ProjectRepository');
      
      const fileRepo = new FileRepository();
      const bucketRepo = new BucketRepository();
      const projectRepo = new ProjectRepository();
      
      const file = await fileRepo.findById(fileId);
      if (!file) {
        return res.status(404).json({
          error: { message: 'File record not found', status: 404 }
        });
      }
      
      const bucket = await bucketRepo.findById(bucketId);
      if (!bucket) {
        return res.status(404).json({
          error: { message: 'Bucket not found', status: 404 }
        });
      }
      
      const project = await projectRepo.findById(bucket.project_id);
      if (!project) {
        return res.status(404).json({
          error: { message: 'Project not found', status: 404 }
        });
      }
      
      // Handle file upload - stream directly (no multer, no memory buffering)
      const storageService = getStorageService();
      const metadata = file.metadata ? JSON.parse(file.metadata) : {};
      metadata.content_type = req.headers['content-type'] || metadata.content_type || 'application/octet-stream';
      
      try {
        // Stream request body directly to storage - no memory buffering
        const result = await storageService.uploadFile(
          project.id,
          bucket.name,
          file.key,
          req, // req is already a readable stream
          metadata
        );
        
        res.status(200).json(result);
      } catch (error) {
        res.status(500).json({
          error: { message: error.message, status: 500 }
        });
      }
      
      req.on('error', (error) => {
        res.status(500).json({
          error: { message: error.message, status: 500 }
        });
      });
    } else {
      res.status(400).json({
        error: { message: 'Invalid URL type', status: 400 }
      });
    }
  } catch (error) {
    if (error.status === 416) {
      return res.status(416).json({
        error: { message: 'Range not satisfiable', status: 416 }
      });
    }
    if (error.message.includes('Invalid') || error.message.includes('expired') || error.message.includes('used')) {
      return res.status(403).json({
        error: { message: error.message, status: 403 }
      });
    }
    next(error);
  }
});

// PUT /signed/:signature/:fileId/:bucketId/:urlType - Handle signed URL upload requests
router.put('/signed/:signature/:fileId/:bucketId/:urlType', async (req, res, next) => {
  try {
    const { signature, fileId, bucketId, urlType } = req.params;
    const { expires, ttl } = req.query;
    
    if (!expires || !ttl) {
      return res.status(400).json({
        error: { message: 'Missing expires or ttl parameters', status: 400 }
      });
    }
    
    if (urlType !== 'upload') {
      return res.status(400).json({
        error: { message: 'PUT method only supports upload URLs', status: 400 }
      });
    }
    
    const signedUrlService = getSignedUrlService();
    
    // Handle duplicate query params (can happen when proxying) - take first value
    const expiresValue = Array.isArray(expires) ? expires[0] : expires;
    const ttlValue = Array.isArray(ttl) ? ttl[0] : ttl;
    
    // Ensure expires and ttl are strings (they come from query params as strings)
    const expiresStr = String(expiresValue);
    const ttlStr = String(ttlValue);
    
    logger.info(`[signedUrls] Validating signed URL: fileId=${fileId}, bucketId=${bucketId}, urlType=${urlType}, expires=${expiresStr}, ttl=${ttlStr}`);
    
    const validation = await signedUrlService.validateSignedUrl(
      signature,
      fileId,
      bucketId,
      urlType,
      expiresStr,
      ttlStr
    );
    
    // Mark URL as used
    if (validation.signed_url_record) {
      await signedUrlService.markUrlAsUsed(validation.signed_url_record.id);
    }
    
    // Handle upload
    const FileRepository = require('../repos/FileRepository');
    const BucketRepository = require('../repos/BucketRepository');
    const ProjectRepository = require('../repos/ProjectRepository');
    const fs = require('fs');
    
    const fileRepo = new FileRepository();
    const bucketRepo = new BucketRepository();
    const projectRepo = new ProjectRepository();
    
    const file = await fileRepo.findById(fileId);
    if (!file) {
      return res.status(404).json({
        error: { message: 'File record not found', status: 404 }
      });
    }
    
    const bucket = await bucketRepo.findById(bucketId);
    if (!bucket) {
      return res.status(404).json({
        error: { message: 'Bucket not found', status: 404 }
      });
    }
    
    // CRITICAL: Validate file belongs to correct bucket BEFORE processing
    if (file.bucket_id !== bucket.id) {
      return res.status(403).json({
        error: { message: 'File does not belong to the specified bucket', status: 403 }
      });
    }
    
    // Use bucket.project_id directly (projects are managed by conductor, not storage_manager)
    const projectId = bucket.project_id;
    
    // Stream request body directly to storage - no memory buffering
    // req is already a readable stream, pipe it directly
    const metadata = file.metadata ? JSON.parse(file.metadata) : {};
    metadata.content_type = req.headers['content-type'] || metadata.content_type || 'application/octet-stream';
    
    try {
      // Get storage service instance
      const storageService = getStorageService();
      
      // Stream directly: req -> storageService.uploadFile (which streams to disk)
      // Pass the existing fileId so we update the placeholder record instead of creating a new one
      logger.info(`[signedUrls] Starting upload for file ${fileId} in bucket ${bucketId}, project ${projectId}`);
      const result = await storageService.uploadFile(
        projectId, // Use bucket.project_id directly (null for system buckets)
        bucket.name,
        file.key,
        req, // req is already a readable stream
        metadata,
        fileId, // Pass existing fileId to update placeholder record
        bucket.system_id || null // System buckets resolve through their system
      );
      
      logger.info(`[signedUrls] Upload completed for file ${fileId}`);
      res.status(200).json(result);
    } catch (error) {
      logger.error(`[signedUrls] Upload error for file ${fileId} in bucket ${bucketId}, project ${projectId}:`, {
        message: error.message,
        stack: error.stack,
        error: error.toString(),
        bucketName: bucket?.name,
        fileKey: file?.key
      });
      if (!res.headersSent) {
        res.status(500).json({
          error: { 
            message: error.message || 'Upload failed', 
            status: 500,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
          }
        });
      }
    }
    
    req.on('error', (error) => {
      logger.error(`[signedUrls] Request stream error for file ${fileId}:`, error.message);
      if (!res.headersSent) {
        res.status(500).json({
          error: { message: error.message || 'Request stream error', status: 500 }
        });
      }
    });
  } catch (error) {
    if (error.message.includes('Invalid') || error.message.includes('expired') || error.message.includes('used')) {
      return res.status(403).json({
        error: { message: error.message, status: 403 }
      });
    }
    next(error);
  }
});

module.exports = router;
