const express = require('express');
const StorageService = require('../services/StorageService');
const validateServiceToken = require('../middleware/auth');
const { handleDirectUpload, handleMultipartUpload } = require('./files');

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
    const fileData = await storageService.downloadFile(null, bucketName, key, systemId);

    res.setHeader('Content-Type', fileData.content_type);
    res.setHeader('Content-Length', fileData.size);
    res.setHeader('ETag', fileData.etag);

    fileData.stream.pipe(res);
  } catch (error) {
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
