const express = require('express');
const busboy = require('busboy');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const StorageService = require('../services/StorageService');
const validateServiceToken = require('../middleware/auth');
const { pipeStreamToResponse } = require('../utils/streamResponse');

const router = express.Router();

// Initialize storage service
const getStorageService = () => {
  return new StorageService(
    process.env.CONDUCTOR_URL,
    process.env.SERVICE_TOKEN
  );
};

// POST /api/projects/:projectId/buckets/:bucketName/files/:key(*) - Upload file
// NOTE: This route should NOT match signed-url routes - they are handled by signedUrlRoutes
// We check req.originalUrl to see the full path before Express parses it
router.post('/:projectId/buckets/:bucketName/files/:key(*)', validateServiceToken, async (req, res, next) => {
  let tempFilePath = null;
  
  try {
    const { projectId, bucketName, key } = req.params;
    
    // CRITICAL: Check if this is a signed-url route FIRST - before any other processing
    // Check req.originalUrl which contains the full original URL path before route matching
    const originalUrl = req.originalUrl || req.url || '';
    
    // If the original URL contains /signed-url/, skip this route entirely
    // Call next() to let Express try the next matching route (signedUrlRoutes)
    if (originalUrl.includes('/signed-url/')) {
      // Skip this route - let signedUrlRoutes handle it
      return next('route');
    }
    
    // Check content type
    const contentType = req.headers['content-type'] || '';
    
    // multipart/form-data -> busboy; anything else (application/octet-stream or a
    // concrete type like audio/mpeg, video/mp4) is a raw-body upload.
    if (contentType.includes('multipart/form-data')) {
      // Handle multipart/form-data with busboy - stream directly to disk
      return handleMultipartUpload(req, res, next, projectId, bucketName, key);
    }

    // Handle direct binary upload (streams to disk; request content-type is recorded)
    return handleDirectUpload(req, res, next, projectId, bucketName, key);
    
  } catch (error) {
    // Clean up temp file if it exists
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    next(error);
  }
});

// Handle direct binary upload (streams directly to storage)
// systemId is optional: when set, the bucket is system-scoped (projectId is null)
async function handleDirectUpload(req, res, next, projectId, bucketName, key, systemId = null) {
  let tempFilePath = null;
  
  try {
    // Create temp file for streaming
    const tempDir = '/tmp/uploads';
    await fs.promises.mkdir(tempDir, { recursive: true });
    tempFilePath = path.join(tempDir, `upload-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    
    const writeStream = fs.createWriteStream(tempFilePath);
    let totalSize = 0;
    
    // Stream request body directly to temp file
    req.on('data', (chunk) => {
      totalSize += chunk.length;
      writeStream.write(chunk);
    });
    
    req.on('end', async () => {
      writeStream.end();
      
      try {
        // Wait for write stream to finish
        await new Promise((resolve, reject) => {
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
        });
        
        // Now stream from temp file to storage service
        const storageService = getStorageService();
        const readStream = fs.createReadStream(tempFilePath);
        
        const metadata = {
          content_type: req.headers['content-type'] || 'application/octet-stream'
        };
        
        const result = await storageService.uploadFile(
          projectId,
          bucketName,
          key,
          readStream,
          metadata,
          null,
          systemId
        );
        
        // Clean up temp file
        await fs.promises.unlink(tempFilePath);
        
        res.status(200).json(result);
      } catch (error) {
        // Clean up temp file on error
        if (tempFilePath && fs.existsSync(tempFilePath)) {
          try {
            await fs.promises.unlink(tempFilePath);
          } catch (e) {
            // Ignore cleanup errors
          }
        }
        
        if (error.message.includes('not found')) {
          return res.status(404).json({
            error: { message: error.message, status: 404 }
          });
        }
        next(error);
      }
    });
    
    req.on('error', async (error) => {
      // Clean up temp file on error
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          await fs.promises.unlink(tempFilePath);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      next(error);
    });
    
  } catch (error) {
    // Clean up temp file on error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        await fs.promises.unlink(tempFilePath);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    next(error);
  }
}

// Handle multipart/form-data upload with busboy - streams directly to disk
// systemId is optional: when set, the bucket is system-scoped (projectId is null)
async function handleMultipartUpload(req, res, next, projectId, bucketName, key, systemId = null) {
  let tempFilePath = null;
  let fileReceived = false;
  let writeFinished = Promise.resolve();
  
  try {
    const bb = busboy({ headers: req.headers });
    const tempDir = '/tmp/uploads';
    await fs.promises.mkdir(tempDir, { recursive: true });
    
    let contentType = 'application/octet-stream';
    let metadata = {};
    
    bb.on('file', (name, file, info) => {
      fileReceived = true;
      const { filename, encoding, mimeType } = info;
      contentType = mimeType || 'application/octet-stream';
      
      // Create temp file path
      tempFilePath = path.join(tempDir, `upload-${Date.now()}-${Math.random().toString(36).substring(7)}`);
      const writeStream = fs.createWriteStream(tempFilePath);
      
      writeFinished = new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
      
      file.on('error', (err) => {
        writeStream.destroy();
        if (tempFilePath && fs.existsSync(tempFilePath)) {
          try {
            fs.unlinkSync(tempFilePath);
          } catch (e) {
            // Ignore cleanup errors
          }
        }
        next(err);
      });
      
      writeStream.on('error', (err) => {
        if (tempFilePath && fs.existsSync(tempFilePath)) {
          try {
            fs.unlinkSync(tempFilePath);
          } catch (e) {
            // Ignore cleanup errors
          }
        }
        next(err);
      });
      
      // pipe() ends writeStream when file ends; wait for 'finish' in bb.on('finish')
      file.pipe(writeStream);
    });
    
    bb.on('field', (name, value) => {
      if (name === 'metadata') {
        try {
          metadata = JSON.parse(value);
        } catch (e) {
          // Ignore invalid JSON
        }
      }
    });
    
    bb.on('finish', async () => {
      if (!fileReceived) {
        return res.status(400).json({
          error: { message: 'No file uploaded', status: 400 }
        });
      }

      try {
        await writeFinished;
      } catch (err) {
        return next(err);
      }
      
      if (!tempFilePath || !fs.existsSync(tempFilePath)) {
        return res.status(500).json({
          error: { message: 'File upload failed', status: 500 }
        });
      }
      
      try {
        // Stream from temp file to storage service
        const storageService = getStorageService();
        const readStream = fs.createReadStream(tempFilePath);
        
        const finalMetadata = {
          content_type: contentType,
          ...metadata
        };
        
        const result = await storageService.uploadFile(
          projectId,
          bucketName,
          key,
          readStream,
          finalMetadata,
          null,
          systemId
        );
        
        // Clean up temp file
        await fs.promises.unlink(tempFilePath);
        
        res.status(200).json(result);
      } catch (error) {
        // Clean up temp file on error
        if (tempFilePath && fs.existsSync(tempFilePath)) {
          try {
            await fs.promises.unlink(tempFilePath);
          } catch (e) {
            // Ignore cleanup errors
          }
        }
        
        if (error.message.includes('not found')) {
          return res.status(404).json({
            error: { message: error.message, status: 404 }
          });
        }
        next(error);
      }
    });
    
    bb.on('error', (err) => {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      next(err);
    });
    
    // Pipe request to busboy
    req.pipe(bb);
    
  } catch (error) {
    // Clean up temp file on error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        await fs.promises.unlink(tempFilePath);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    next(error);
  }
}

// GET /api/projects/:projectId/buckets/:bucketName/files/:key(*) - Download file
router.get('/:projectId/buckets/:bucketName/files/:key(*)', validateServiceToken, async (req, res, next) => {
  try {
    const { projectId, bucketName, key } = req.params;
    
    const storageService = getStorageService();
    const fileData = await storageService.downloadFile(projectId, bucketName, key, null, req.headers['range']);
    
    // Set headers
    res.setHeader('Content-Type', fileData.content_type);
    res.setHeader('Content-Length', fileData.size);
    res.setHeader('ETag', fileData.etag);
    res.setHeader('Accept-Ranges', 'bytes');
    if (fileData.contentRange) {
      res.status(206);
      res.setHeader('Content-Range', fileData.contentRange);
    }
    
    // Stream file
    pipeStreamToResponse(fileData.stream, res);
  } catch (error) {
    if (error.status === 416) {
      return res.status(416).json({
        error: { message: 'Range not satisfiable', status: 416 }
      });
    }
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: { message: error.message, status: 404 }
      });
    }
    next(error);
  }
});

// HEAD /api/projects/:projectId/buckets/:bucketName/files/:key(*) - Get file metadata
router.head('/:projectId/buckets/:bucketName/files/:key(*)', validateServiceToken, async (req, res, next) => {
  try {
    const { projectId, bucketName, key } = req.params;
    
    const storageService = getStorageService();
    const metadata = await storageService.getFileMetadata(projectId, bucketName, key);
    
    res.setHeader('Content-Length', metadata.size);
    res.setHeader('Content-Type', metadata.content_type);
    res.setHeader('ETag', metadata.etag);
    res.setHeader('Last-Modified', new Date(metadata.updated_at).toUTCString());
    
    res.status(200).end();
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).end();
    }
    next(error);
  }
});

// DELETE /api/projects/:projectId/buckets/:bucketName/files/:key(*) - Delete file
router.delete('/:projectId/buckets/:bucketName/files/:key(*)', validateServiceToken, async (req, res, next) => {
  try {
    const { projectId, bucketName, key } = req.params;
    
    const storageService = getStorageService();
    await storageService.deleteFile(projectId, bucketName, key);
    
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

// GET /api/projects/:projectId/buckets/:bucketName/files - List files (S3-style)
router.get('/:projectId/buckets/:bucketName/files', validateServiceToken, async (req, res, next) => {
  try {
    const { projectId, bucketName } = req.params;
    const { prefix = '', maxKeys = 1000, delimiter = '/', offset = 0 } = req.query;
    
    const storageService = getStorageService();
    const result = await storageService.listFiles(
      projectId,
      bucketName,
      prefix,
      parseInt(maxKeys),
      delimiter,
      parseInt(offset)
    );
    
    res.json({
      files: result.files,
      folders: result.folders,
      prefix: result.prefix,
      delimiter: result.delimiter,
      count: result.count,
      maxKeys: parseInt(maxKeys),
      offset: parseInt(offset),
      hasMore: result.hasMore
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: { message: error.message, status: 404 }
      });
    }
    next(error);
  }
});

module.exports = router;
module.exports.handleDirectUpload = handleDirectUpload;
module.exports.handleMultipartUpload = handleMultipartUpload;
