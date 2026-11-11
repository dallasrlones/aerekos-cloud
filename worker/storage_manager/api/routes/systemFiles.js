const express = require('express');
const StorageService = require('../services/StorageService');
const validateServiceToken = require('../middleware/auth');
const { handleDirectUpload, handleMultipartUpload } = require('./files');
const { pipeStreamToResponse } = require('../utils/streamResponse');

const router = express.Router();

// System bucket file routes - mounted at /api/systems, so the full paths are:
//   POST   /api/systems/:systemId/buckets/:bucketName/files/:key(*)  - upload (octet-stream or multipart)
//   GET    /api/systems/:systemId/buckets/:bucketName/files/:key(*)  - download
//   HEAD   /api/systems/:systemId/buckets/:bucketName/files/:key(*)  - metadata
//   DELETE /api/systems/:systemId/buckets/:bucketName/files/:key(*)  - delete
//   GET    /api/systems/:systemId/buckets/:bucketName/files          - list (S3-style)
//
// System files land in the bucket's base_path (e.g. /mnt/usb24tb/aerekos-media)
// when one is set, otherwise in the default STORAGE_PATH.

const getStorageService = () => {
  return new StorageService(
    process.env.CONDUCTOR_URL,
    process.env.SERVICE_TOKEN
  );
};

const SignedUrlService = require('../services/SignedUrlService');

const getSignedUrlService = () => {
  return new SignedUrlService(process.env.CONDUCTOR_URL);
};

// POST /api/systems/:systemId/buckets/:bucketName/files/:key(*)/signed-url/download
// Generate a short-lived SIGNED DOWNLOAD URL (S3-style). The phone/browser fetches
// this URL directly from storage_manager (no auth header, Range supported for seeking).
// Declared BEFORE the generic /files/:key(*) upload route so the wildcard doesn't swallow it.
router.post('/:systemId/buckets/:bucketName/files/:key(*)/signed-url/download', validateServiceToken, async (req, res, next) => {
  try {
    const { systemId, bucketName, key } = req.params;
    const { ttl_seconds = 900 } = req.body;
    const signedUrlService = getSignedUrlService();
    const result = await signedUrlService.generateSignedDownloadUrlForSystem(systemId, bucketName, key, parseInt(ttl_seconds));
    res.status(201).json(result);
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: { message: error.message, status: 404 } });
    }
    next(error);
  }
});

// POST /api/systems/:systemId/buckets/:bucketName/files/:key(*)/signed-url/upload
// Generate a one-shot SIGNED UPLOAD URL (PUT the file to it).
router.post('/:systemId/buckets/:bucketName/files/:key(*)/signed-url/upload', validateServiceToken, async (req, res, next) => {
  try {
    const { systemId, bucketName, key } = req.params;
    const { ttl_seconds = 3600, metadata = {} } = req.body;
    const signedUrlService = getSignedUrlService();
    const result = await signedUrlService.generateSignedUploadUrlForSystem(systemId, bucketName, key, parseInt(ttl_seconds), metadata);
    res.status(201).json(result);
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: { message: error.message, status: 404 } });
    }
    next(error);
  }
});

// Upload to a system bucket
router.post('/:systemId/buckets/:bucketName/files/:key(*)', validateServiceToken, async (req, res, next) => {
  try {
    const { systemId, bucketName, key } = req.params;

    const contentType = req.headers['content-type'] || '';

    // multipart/form-data -> busboy; anything else (application/octet-stream or a
    // concrete type like audio/mpeg, video/mp4) is a raw-body upload.
    if (contentType.includes('multipart/form-data')) {
      return handleMultipartUpload(req, res, next, null, bucketName, key, systemId);
    }

    return handleDirectUpload(req, res, next, null, bucketName, key, systemId);
  } catch (error) {
    next(error);
  }
});

// Download from a system bucket
router.get('/:systemId/buckets/:bucketName/files/:key(*)', validateServiceToken, async (req, res, next) => {
  try {
    const { systemId, bucketName, key } = req.params;

    const storageService = getStorageService();
    const fileData = await storageService.downloadFile(null, bucketName, key, systemId, req.headers['range']);

    res.setHeader('Content-Type', fileData.content_type);
    res.setHeader('Content-Length', fileData.size);
    res.setHeader('ETag', fileData.etag);
    res.setHeader('Accept-Ranges', 'bytes');
    if (fileData.contentRange) {
      res.status(206);
      res.setHeader('Content-Range', fileData.contentRange);
    }

    pipeStreamToResponse(fileData.stream, res);
  } catch (error) {
    if (error.status === 416) {
      return res.status(416).json({ error: { message: 'Range not satisfiable', status: 416 } });
    }
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: { message: error.message, status: 404 } });
    }
    next(error);
  }
});

// HEAD on a system bucket file
router.head('/:systemId/buckets/:bucketName/files/:key(*)', validateServiceToken, async (req, res, next) => {
  try {
    const { systemId, bucketName, key } = req.params;

    const storageService = getStorageService();
    const metadata = await storageService.getFileMetadata(null, bucketName, key, systemId);

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

// Delete a file from a system bucket
router.delete('/:systemId/buckets/:bucketName/files/:key(*)', validateServiceToken, async (req, res, next) => {
  try {
    const { systemId, bucketName, key } = req.params;

    const storageService = getStorageService();
    await storageService.deleteFile(null, bucketName, key, systemId);

    res.status(204).end();
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: { message: error.message, status: 404 } });
    }
    next(error);
  }
});

// List files in a system bucket (S3-style with folders)
router.get('/:systemId/buckets/:bucketName/files', validateServiceToken, async (req, res, next) => {
  try {
    const { systemId, bucketName } = req.params;
    const { prefix = '', maxKeys = 1000, delimiter = '/', offset = 0 } = req.query;

    const storageService = getStorageService();
    const result = await storageService.listFiles(
      null,
      bucketName,
      prefix,
      parseInt(maxKeys),
      delimiter,
      parseInt(offset),
      systemId
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
      return res.status(404).json({ error: { message: error.message, status: 404 } });
    }
    next(error);
  }
});

module.exports = router;
