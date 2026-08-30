const express = require('express');
const router = express.Router();
const KeyService = require('../services/KeyService');
const KeyRepository = require('../repos/KeyRepository');
const Joi = require('joi');

// Initialize service (will be set up in index.js)
let keyService;

// Initialize key service with master key
function initializeKeyService(masterKey) {
  const keyRepository = new KeyRepository();
  keyService = new KeyService(keyRepository, masterKey);
}

// Validation schemas
const createKeySchema = Joi.object({
  name: Joi.string().required().min(1).max(100),
  type: Joi.string().valid('symmetric', 'asymmetric', 'master').required(),
  algorithm: Joi.string().required(),
  metadata: Joi.object().optional()
});

/**
 * POST /api/keys
 * Create a new encryption key
 */
router.post('/', async (req, res, next) => {
  try {
    const { error, value } = createKeySchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: { message: error.details[0].message, status: 400 }
      });
    }
    
    const { name, type, algorithm, metadata } = value;
    const key = await keyService.createKey(name, type, algorithm, metadata);
    
    res.status(201).json(key);
  } catch (err) {
    if (err.message.includes('already exists')) {
      return res.status(409).json({
        error: { message: err.message, status: 409 }
      });
    }
    next(err);
  }
});

/**
 * GET /api/keys
 * List all keys (with optional filtering)
 */
router.get('/', async (req, res, next) => {
  try {
    const filter = {};
    
    if (req.query.type) {
      filter.type = req.query.type;
    }
    
    if (req.query.active !== undefined) {
      filter.is_active = req.query.active === 'true';
    }
    
    const keys = await keyService.listKeys(filter);
    
    res.json({
      keys,
      total: keys.length
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/keys/:name
 * Get key by name (latest version)
 */
router.get('/:name', async (req, res, next) => {
  try {
    const { name } = req.params;
    const key = await keyService.getKey(name);
    
    res.json(key);
  } catch (err) {
    if (err.message.includes('not found')) {
      return res.status(404).json({
        error: { message: err.message, status: 404 }
      });
    }
    next(err);
  }
});

/**
 * GET /api/keys/:name/versions
 * Get all versions of a key
 */
router.get('/:name/versions', async (req, res, next) => {
  try {
    const { name } = req.params;
    const keys = await keyService.listKeys({ name });
    
    res.json({
      name,
      versions: keys
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/keys/:name/:version
 * Get specific key version
 */
router.get('/:name/:version', async (req, res, next) => {
  try {
    const { name, version } = req.params;
    const versionNum = parseInt(version, 10);
    
    if (isNaN(versionNum)) {
      return res.status(400).json({
        error: { message: 'Invalid version number', status: 400 }
      });
    }
    
    const key = await keyService.getKey(name, versionNum);
    
    res.json(key);
  } catch (err) {
    if (err.message.includes('not found')) {
      return res.status(404).json({
        error: { message: err.message, status: 404 }
      });
    }
    next(err);
  }
});

/**
 * POST /api/keys/:name/rotate
 * Rotate a key (create new version)
 */
router.post('/:name/rotate', async (req, res, next) => {
  try {
    const { name } = req.params;
    const newKey = await keyService.rotateKey(name);
    
    res.json(newKey);
  } catch (err) {
    if (err.message.includes('not found')) {
      return res.status(404).json({
        error: { message: err.message, status: 404 }
      });
    }
    next(err);
  }
});

/**
 * DELETE /api/keys/:name
 * Delete key (all versions)
 */
router.delete('/:name', async (req, res, next) => {
  try {
    const { name } = req.params;
    await keyService.deleteKey(name);
    
    res.status(204).send();
  } catch (err) {
    if (err.message.includes('not found')) {
      return res.status(404).json({
        error: { message: err.message, status: 404 }
      });
    }
    next(err);
  }
});

/**
 * DELETE /api/keys/:name/:version
 * Delete specific key version
 */
router.delete('/:name/:version', async (req, res, next) => {
  try {
    const { name, version } = req.params;
    const versionNum = parseInt(version, 10);
    
    if (isNaN(versionNum)) {
      return res.status(400).json({
        error: { message: 'Invalid version number', status: 400 }
      });
    }
    
    await keyService.deleteKeyVersion(name, versionNum);
    
    res.status(204).send();
  } catch (err) {
    if (err.message.includes('not found')) {
      return res.status(404).json({
        error: { message: err.message, status: 404 }
      });
    }
    next(err);
  }
});

/**
 * POST /api/keys/:name/archive
 * Archive a key (mark as inactive)
 */
router.post('/:name/archive', async (req, res, next) => {
  try {
    const { name } = req.params;
    const archivedKey = await keyService.archiveKey(name);
    
    res.json(archivedKey);
  } catch (err) {
    if (err.message.includes('not found')) {
      return res.status(404).json({
        error: { message: err.message, status: 404 }
      });
    }
    next(err);
  }
});

module.exports = router;
module.exports.initializeKeyService = initializeKeyService;
