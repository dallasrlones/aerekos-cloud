const express = require('express');
const BucketService = require('../services/BucketService');
const validateServiceToken = require('../middleware/auth');

const router = express.Router();

// System buckets live outside projects: they are assigned to a "system"
// (e.g. 'aerekos') and may carry a physical base_path (e.g. /mnt/usb24tb/aerekos-media)
// so their data lands on a specific disk/volume.
//
// Mounted at /api/systems -> routes are /api/systems/:systemId/buckets[...]

let bucketService = null;

function initializeSystemBucketService(conductorUrl, serviceToken) {
  bucketService = new BucketService(conductorUrl, serviceToken);
}

// Initialize with environment variables if available (mirrors routes/buckets.js)
if (process.env.CONDUCTOR_URL && process.env.SERVICE_TOKEN) {
  initializeSystemBucketService(process.env.CONDUCTOR_URL, process.env.SERVICE_TOKEN);
} else {
  bucketService = new BucketService();
}

// POST /api/systems/:systemId/buckets - Create a system bucket
router.post('/:systemId/buckets', validateServiceToken, async (req, res, next) => {
  try {
    if (!bucketService) {
      return res.status(503).json({ error: { message: 'Bucket service not initialized', status: 503 } });
    }

    const { systemId } = req.params;
    const { name, encryption_key_name, base_path, metadata, storage_class } = req.body;
    const createdBy = req.service?.name || 'unknown';

    if (!name) {
      return res.status(400).json({ error: { message: 'Bucket name is required', status: 400 } });
    }

    const meta = metadata && typeof metadata === 'object' ? { ...metadata } : (metadata ? { value: metadata } : {});
    if (storage_class) meta.storage_class = storage_class;

    const bucket = await bucketService.createSystemBucket(
      systemId,
      name,
      createdBy,
      encryption_key_name,
      base_path,
      meta
    );

    res.status(201).json(bucket);
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: { message: error.message, status: 404 } });
    }
    if (error.message.includes('already exists')) {
      return res.status(409).json({ error: { message: error.message, status: 409 } });
    }
    next(error);
  }
});

// GET /api/systems/:systemId/buckets - List system buckets
router.get('/:systemId/buckets', validateServiceToken, async (req, res, next) => {
  try {
    const { systemId } = req.params;
    const buckets = await bucketService.listSystemBuckets(systemId);
    res.json({ buckets });
  } catch (error) {
    next(error);
  }
});

// GET /api/systems/:systemId/buckets/:bucketName - Get a system bucket
router.get('/:systemId/buckets/:bucketName', validateServiceToken, async (req, res, next) => {
  try {
    const { systemId, bucketName } = req.params;
    const bucket = await bucketService.getSystemBucket(systemId, bucketName);
    res.json(bucket);
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: { message: error.message, status: 404 } });
    }
    next(error);
  }
});

// PATCH /api/systems/:systemId/buckets/:bucketName - Update a system bucket
router.patch('/:systemId/buckets/:bucketName', validateServiceToken, async (req, res, next) => {
  try {
    const { systemId, bucketName } = req.params;
    const { encryption_key_name, base_path, metadata } = req.body;

    const updates = {};
    if (encryption_key_name) updates.encryption_key_name = encryption_key_name;
    if (base_path !== undefined) updates.base_path = base_path;
    if (metadata) updates.metadata = metadata;

    const bucket = await bucketService.updateSystemBucket(systemId, bucketName, updates);
    res.json(bucket);
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: { message: error.message, status: 404 } });
    }
    next(error);
  }
});

// DELETE /api/systems/:systemId/buckets/:bucketName - Delete a system bucket
router.delete('/:systemId/buckets/:bucketName', validateServiceToken, async (req, res, next) => {
  try {
    const { systemId, bucketName } = req.params;
    await bucketService.deleteSystemBucket(systemId, bucketName);
    res.status(204).end();
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: { message: error.message, status: 404 } });
    }
    if (error.message.includes('has')) {
      return res.status(409).json({ error: { message: error.message, status: 409 } });
    }
    next(error);
  }
});

module.exports = router;
module.exports.initializeSystemBucketService = initializeSystemBucketService;
