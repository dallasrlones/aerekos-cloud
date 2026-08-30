const express = require('express');
const busboy = require('busboy');
const fs = require('fs');
const path = require('path');
const ChunkedUploadService = require('../services/ChunkedUploadService');
const validateServiceToken = require('../middleware/auth');

const router = express.Router();

// Initialize chunked upload service
const getChunkedUploadService = () => {
  return new ChunkedUploadService(
    process.env.CONDUCTOR_URL,
    process.env.SERVICE_TOKEN
  );
};

// POST /api/projects/:projectId/buckets/:bucketName/files/:key/upload/initiate - Initiate chunked upload
router.post('/:projectId/buckets/:bucketName/files/:key(*)/upload/initiate', validateServiceToken, async (req, res, next) => {
  try {
    const { projectId, bucketName, key } = req.params;
    const { total_size, chunk_size = 5242880, metadata = {} } = req.body; // Default 5MB chunks
    
    if (!total_size) {
      return res.status(400).json({
        error: { message: 'total_size is required', status: 400 }
      });
    }
    
    const chunkedUploadService = getChunkedUploadService();
    const result = await chunkedUploadService.initiateChunkedUpload(
      projectId,
      bucketName,
      key,
      parseInt(total_size),
      parseInt(chunk_size),
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

// PUT /api/projects/:projectId/buckets/:bucketName/files/:key/upload/:uploadId/chunk/:chunkNumber - Upload chunk
router.put('/:projectId/buckets/:bucketName/files/:key(*)/upload/:uploadId/chunk/:chunkNumber', validateServiceToken, async (req, res, next) => {
  let tempFilePath = null;
  
  try {
    const { uploadId, chunkNumber } = req.params;
    
    const contentType = req.headers['content-type'] || '';
    
    // Handle direct binary upload (application/octet-stream)
    if (contentType.includes('application/octet-stream')) {
      // Stream chunk directly to temp file, then read it
      const tempDir = '/tmp/chunks';
      await fs.promises.mkdir(tempDir, { recursive: true });
      tempFilePath = path.join(tempDir, `chunk-${uploadId}-${chunkNumber}-${Date.now()}`);
      
      const writeStream = fs.createWriteStream(tempFilePath);
      
      req.on('data', (chunk) => {
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
          
          const chunkedUploadService = getChunkedUploadService();
          const chunkData = await fs.promises.readFile(tempFilePath);
          
          const result = await chunkedUploadService.uploadChunk(
            uploadId,
            parseInt(chunkNumber),
            chunkData
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
      
      return; // Exit early, handling will be done in req.on('end')
    }
    
    // Handle multipart/form-data with busboy
    const bb = busboy({ headers: req.headers });
    let chunkReceived = false;
    
    bb.on('file', (name, file, info) => {
      chunkReceived = true;
      const tempDir = '/tmp/chunks';
      fs.mkdirSync(tempDir, { recursive: true });
      tempFilePath = path.join(tempDir, `chunk-${uploadId}-${chunkNumber}-${Date.now()}`);
      const writeStream = fs.createWriteStream(tempFilePath);
      
      // pipe() ends writeStream when the file stream ends
      file.pipe(writeStream);

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
      
      writeStream.on('finish', async () => {
        try {
          const chunkedUploadService = getChunkedUploadService();
          const chunkData = await fs.promises.readFile(tempFilePath);
          
          const result = await chunkedUploadService.uploadChunk(
            uploadId,
            parseInt(chunkNumber),
            chunkData
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
    });
    
    bb.on('finish', () => {
      if (!chunkReceived) {
        return res.status(400).json({
          error: { message: 'Chunk data is required', status: 400 }
        });
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
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: { message: error.message, status: 404 }
      });
    }
    next(error);
  }
});

// POST /api/projects/:projectId/buckets/:bucketName/files/:key/upload/:uploadId/complete - Complete chunked upload
router.post('/:projectId/buckets/:bucketName/files/:key(*)/upload/:uploadId/complete', validateServiceToken, async (req, res, next) => {
  try {
    const { uploadId } = req.params;
    const { chunk_etags = [] } = req.body;
    
    const chunkedUploadService = getChunkedUploadService();
    const result = await chunkedUploadService.completeChunkedUpload(uploadId, chunk_etags);
    
    res.status(200).json(result);
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: { message: error.message, status: 404 }
      });
    }
    next(error);
  }
});

// DELETE /api/projects/:projectId/buckets/:bucketName/files/:key/upload/:uploadId - Abort chunked upload
router.delete('/:projectId/buckets/:bucketName/files/:key(*)/upload/:uploadId', validateServiceToken, async (req, res, next) => {
  try {
    const { uploadId } = req.params;
    
    const chunkedUploadService = getChunkedUploadService();
    await chunkedUploadService.abortChunkedUpload(uploadId);
    
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

// GET /api/projects/:projectId/buckets/:bucketName/files/:key/upload/:uploadId/status - Get upload status
router.get('/:projectId/buckets/:bucketName/files/:key(*)/upload/:uploadId/status', validateServiceToken, async (req, res, next) => {
  try {
    const { uploadId } = req.params;
    
    const chunkedUploadService = getChunkedUploadService();
    const status = await chunkedUploadService.getChunkedUploadStatus(uploadId);
    
    res.json(status);
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
