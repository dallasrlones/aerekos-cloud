const express = require('express');
const BucketService = require('../services/BucketService');
const validateServiceToken = require('../middleware/auth');

const router = express.Router();

// Initialize bucket service with conductor URL and service token
let bucketService = null;

function initializeBucketService(conductorUrl, serviceToken) {
  bucketService = new BucketService(conductorUrl, serviceToken);
}

// Initialize with environment variables if available
if (process.env.CONDUCTOR_URL && process.env.SERVICE_TOKEN) {
  initializeBucketService(process.env.CONDUCTOR_URL, process.env.SERVICE_TOKEN);
} else {
  // Fallback: create without conductor URL (will use mock key_manager)
  bucketService = new BucketService();
}

// POST /api/projects/:projectId/buckets - Create bucket
router.post('/:projectId/buckets', validateServiceToken, async (req, res, next) => {
  try {
    if (!bucketService) {
      return res.status(503).json({
        error: { message: 'Bucket service not initialized', status: 503 }
      });
    }

    const { projectId } = req.params;
    const { name, encryption_key_name, metadata, storage_class } = req.body;
    const createdBy = req.service?.name || 'unknown';
    
    if (!name) {
      return res.status(400).json({
        error: { message: 'Bucket name is required', status: 400 }
      });
    }

    const meta = metadata && typeof metadata === 'object' ? { ...metadata } : (metadata ? { value: metadata } : {});
    if (storage_class) meta.storage_class = storage_class;
    
    const bucket = await bucketService.createBucket(
      projectId,
      name,
      createdBy,
      encryption_key_name,
      meta
    );
    
    res.status(201).json(bucket);
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: { message: error.message, status: 404 }
      });
    }
    if (error.message.includes('already exists')) {
      return res.status(409).json({
        error: { message: error.message, status: 409 }
      });
    }
    next(error);
  }
});

// GET /api/projects/:projectId/buckets - List buckets
router.get('/:projectId/buckets', validateServiceToken, async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const buckets = await bucketService.listBuckets(projectId);
    res.json({ buckets });
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: { message: error.message, status: 404 }
      });
    }
    next(error);
  }
});

// IMPORTANT: More specific routes must come BEFORE generic parameterized routes
// GET /api/projects/:projectId/buckets/by-key/:keyName - Find buckets using a key
router.get('/:projectId/buckets/by-key/:keyName', validateServiceToken, async (req, res, next) => {
  try {
    const { projectId, keyName } = req.params;
    const buckets = await bucketService.findBucketsByEncryptionKey(keyName);
    
    // Filter by project if projectId is provided
    const projectBuckets = projectId 
      ? buckets.filter(b => b.project_id === projectId)
      : buckets;
    
    res.json({ buckets: projectBuckets, count: projectBuckets.length });
  } catch (error) {
    next(error);
  }
});

// GET /api/projects/:projectId/buckets/:bucketName - Get bucket
router.get('/:projectId/buckets/:bucketName', validateServiceToken, async (req, res, next) => {
  try {
    const { projectId, bucketName } = req.params;
    const bucket = await bucketService.getBucket(projectId, bucketName);
    res.json(bucket);
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: { message: error.message, status: 404 }
      });
    }
    next(error);
  }
});

// DELETE /api/projects/:projectId/buckets/:bucketName - Delete bucket
router.delete('/:projectId/buckets/:bucketName', validateServiceToken, async (req, res, next) => {
  try {
    const { projectId, bucketName } = req.params;
    await bucketService.deleteBucket(projectId, bucketName);
    res.status(204).end();
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: { message: error.message, status: 404 }
      });
    }
    if (error.message.includes('has')) {
      return res.status(409).json({
        error: { message: error.message, status: 409 }
      });
    }
    next(error);
  }
});

// PATCH /api/projects/:projectId/buckets/:bucketName - Update bucket
router.patch('/:projectId/buckets/:bucketName', validateServiceToken, async (req, res, next) => {
  try {
    const { projectId, bucketName } = req.params;
    const { encryption_key_name, metadata } = req.body;
    
    const updates = {};
    if (encryption_key_name) updates.encryption_key_name = encryption_key_name;
    if (metadata) updates.metadata = metadata;
    
    const bucket = await bucketService.updateBucket(projectId, bucketName, updates);
    res.json(bucket);
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: { message: error.message, status: 404 }
      });
    }
    next(error);
  }
});

// POST /api/projects/:projectId/buckets/replace-key - Replace encryption key in all buckets
router.post('/:projectId/buckets/replace-key', validateServiceToken, async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { old_key_name, new_key_name } = req.body;
    
    if (!old_key_name || !new_key_name) {
      return res.status(400).json({
        error: { message: 'old_key_name and new_key_name are required', status: 400 }
      });
    }
    
    const updatedCount = await bucketService.replaceEncryptionKey(old_key_name, new_key_name);
    res.json({ 
      message: `Updated ${updatedCount} bucket(s) to use new encryption key`,
      updated_count: updatedCount
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/projects/:projectId/buckets/:name/sftp — record optional SFTP ingest (Transfer Family analog)
router.post('/:projectId/buckets/:name/sftp', validateServiceToken, async (req, res, next) => {
  try {
    const { projectId, name } = req.params;
    const bucket = await bucketService.getBucket(projectId, name);
    const meta = bucket.metadata && typeof bucket.metadata === 'object' ? { ...bucket.metadata } : {};
    meta.sftp = {
      enabled: true,
      user: req.body?.user || 'sftp',
      prefix: req.body?.prefix || '/',
    };
    const updated = await bucketService.updateBucket(projectId, name, { metadata: meta });
    res.json({
      ok: true,
      sftp: meta.sftp,
      bucket: updated,
      note: 'Ingest endpoint recorded. Daemon is provisioned by transfer_manager.',
    });
  } catch (error) {
    if (error.message && error.message.includes('not found')) {
      return res.status(404).json({ error: { message: error.message, status: 404 } });
    }
    next(error);
  }
});

module.exports = router;
module.exports.initializeBucketService = initializeBucketService;
