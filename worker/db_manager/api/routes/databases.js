const express = require('express');
const DatabaseService = require('../services/DatabaseService');
const BackupService = require('../services/BackupService');
const validateServiceToken = require('../middleware/auth');
const joi = require('joi');

const router = express.Router();

// Initialize database service (will be set during startup)
let databaseService = null;
let backupService = null;

function initializeDatabaseService(conductorUrl, serviceToken) {
  if (!conductorUrl || !serviceToken) {
    throw new Error('Conductor URL and service token are required');
  }
  databaseService = new DatabaseService(conductorUrl, serviceToken);
  backupService = new BackupService(conductorUrl, serviceToken, databaseService);
}

// Initialize with environment variables if available (for development)
if (process.env.CONDUCTOR_URL && process.env.SERVICE_TOKEN) {
  initializeDatabaseService(process.env.CONDUCTOR_URL, process.env.SERVICE_TOKEN);
}

// Validation schemas
const createDatabaseSchema = joi.object({
  name: joi.string().required().min(3).max(100),
  type: joi.string().required().valid('postgresql', 'mongodb', 'neo4j', 'elasticsearch', 'redis', 'sqlite3', 'lancedb'),
  username: joi.string().optional().min(3).max(63),  // Optional - auto-generated if not provided
  password: joi.string().optional().min(8),  // Optional - auto-generated if not provided
  worker_id: joi.string().optional(),  // Optional - uses current worker if not provided
  port: joi.number().optional().min(1024).max(65535),  // Optional - auto-assigned if not provided
  resource_limits: joi.object({
    cpu_cores: joi.number().optional().min(0.1),
    ram_gb: joi.number().optional().min(0.5),
    disk_gb: joi.number().optional().min(1)
  }).optional(),
  storage: joi.object({
    type: joi.string().optional().valid('volume', 'bind').default('volume'),  // 'volume' (Docker volume) or 'bind' (bind mount)
    location: joi.string().optional(),  // For 'bind': host path. For 'volume': custom volume name (optional)
    driver: joi.string().optional(),  // Volume driver (e.g., 'local', 'nfs', etc.)
    driver_options: joi.object().optional()  // Volume driver options
  }).optional(),
  metadata: joi.object().optional()
});

/**
 * POST /api/databases - Create a new database instance
 */
router.post('/', validateServiceToken, async (req, res, next) => {
  try {
    if (!databaseService) {
      return res.status(503).json({
        error: { message: 'Database service not initialized', status: 503 }
      });
    }

    // Extract projectId from query params (required)
    const projectId = req.query.project_id;
    if (!projectId) {
      return res.status(400).json({
        error: { message: 'project_id is required in query parameters', status: 400 }
      });
    }

    const { error, value } = createDatabaseSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: { message: error.details[0].message, status: 400 }
      });
    }

    const dbInstance = await databaseService.createDatabase(
      value.name,
      value.type,
      projectId,
      {
        username: value.username,
        password: value.password,
        worker_id: value.worker_id,
        port: value.port,
        resource_limits: value.resource_limits,
        metadata: value.metadata
      }
    );

    res.status(201).json(dbInstance);
  } catch (error) {
    if (error.message.includes('already exists')) {
      return res.status(409).json({
        error: { message: error.message, status: 409 }
      });
    }
    next(error);
  }
});

/**
 * GET /api/databases - List all databases
 */
router.get('/', validateServiceToken, async (req, res, next) => {
  try {
    if (!databaseService) {
      return res.status(503).json({
        error: { message: 'Database service not initialized', status: 503 }
      });
    }

    // Extract projectId from query params (required)
    const projectId = req.query.project_id;
    if (!projectId) {
      return res.status(400).json({
        error: { message: 'project_id is required in query parameters', status: 400 }
      });
    }

    const filter = {};
    if (req.query.type) filter.type = req.query.type;
    if (req.query.worker_id) filter.worker_id = req.query.worker_id;
    if (req.query.status) filter.status = req.query.status;

    const databases = await databaseService.listDatabases(projectId, filter);

    res.json({
      databases,
      total: databases.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/databases/:name - Get database details
 */
router.get('/:name', validateServiceToken, async (req, res, next) => {
  try {
    if (!databaseService) {
      return res.status(503).json({
        error: { message: 'Database service not initialized', status: 503 }
      });
    }

    // Extract projectId from query params (required)
    const projectId = req.query.project_id;
    if (!projectId) {
      return res.status(400).json({
        error: { message: 'project_id is required in query parameters', status: 400 }
      });
    }

    const dbInstance = await databaseService.getDatabase(req.params.name, projectId);
    res.json(dbInstance);
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: { message: error.message, status: 404 }
      });
    }
    next(error);
  }
});

/**
 * GET /api/databases/:name/connection - Get decrypted connection string
 */
router.get('/:name/connection', validateServiceToken, async (req, res, next) => {
  try {
    if (!databaseService) {
      return res.status(503).json({
        error: { message: 'Database service not initialized', status: 503 }
      });
    }

    // Extract projectId from query params (required)
    const projectId = req.query.project_id;
    if (!projectId) {
      return res.status(400).json({
        error: { message: 'project_id is required in query parameters', status: 400 }
      });
    }

    const dbInstance = await databaseService.getDatabase(req.params.name, projectId);
    const password = await databaseService.getPassword(req.params.name, projectId);
    
    // Rebuild connection string with current host IP (not the stored one)
    const host = databaseService.getHostIp();
    const connectionString = databaseService.buildConnectionString(dbInstance.type, {
      username: dbInstance.username,
      password: password,
      host: host,
      port: dbInstance.port,
      database: dbInstance.name
    });

    res.json({
      connection_string: connectionString,
      username: dbInstance.username,
      password: password,
      host: host,
      port: dbInstance.port,
      database: dbInstance.name
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

/**
 * DELETE /api/databases/:name - Delete database instance
 */
router.delete('/:name', validateServiceToken, async (req, res, next) => {
  try {
    if (!databaseService) {
      return res.status(503).json({
        error: { message: 'Database service not initialized', status: 503 }
      });
    }

    // Extract projectId from query params (required)
    const projectId = req.query.project_id;
    if (!projectId) {
      return res.status(400).json({
        error: { message: 'project_id is required in query parameters', status: 400 }
      });
    }

    await databaseService.deleteDatabase(req.params.name, projectId);
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

/**
 * POST /api/databases/:name/start - Start database container
 */
router.post('/:name/start', validateServiceToken, async (req, res, next) => {
  try {
    if (!databaseService) {
      return res.status(503).json({
        error: { message: 'Database service not initialized', status: 503 }
      });
    }

    // Extract projectId from query params (required)
    const projectId = req.query.project_id;
    if (!projectId) {
      return res.status(400).json({
        error: { message: 'project_id is required in query parameters', status: 400 }
      });
    }

    const dbInstance = await databaseService.startDatabase(req.params.name, projectId);
    res.json(dbInstance);
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: { message: error.message, status: 404 }
      });
    }
    next(error);
  }
});

/**
 * POST /api/databases/:name/stop - Stop database container
 */
router.post('/:name/stop', validateServiceToken, async (req, res, next) => {
  try {
    if (!databaseService) {
      return res.status(503).json({
        error: { message: 'Database service not initialized', status: 503 }
      });
    }

    // Extract projectId from query params (required)
    const projectId = req.query.project_id;
    if (!projectId) {
      return res.status(400).json({
        error: { message: 'project_id is required in query parameters', status: 400 }
      });
    }

    const dbInstance = await databaseService.stopDatabase(req.params.name, projectId);
    res.json(dbInstance);
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: { message: error.message, status: 404 }
      });
    }
    next(error);
  }
});

/**
 * POST /api/databases/:name/restart - Restart database container
 */
router.post('/:name/restart', validateServiceToken, async (req, res, next) => {
  try {
    if (!databaseService) {
      return res.status(503).json({
        error: { message: 'Database service not initialized', status: 503 }
      });
    }

    // Extract projectId from query params (required)
    const projectId = req.query.project_id;
    if (!projectId) {
      return res.status(400).json({
        error: { message: 'project_id is required in query parameters', status: 400 }
      });
    }

    const dbInstance = await databaseService.restartDatabase(req.params.name, projectId);
    res.json(dbInstance);
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: { message: error.message, status: 404 }
      });
    }
    next(error);
  }
});

/**
 * POST /api/databases/:name/backups - Create backup
 */
router.post('/:name/backups', validateServiceToken, async (req, res, next) => {
  try {
    if (!databaseService || !backupService) {
      return res.status(503).json({
        error: { message: 'Database service not initialized', status: 503 }
      });
    }

    const projectId = req.query.project_id;
    if (!projectId) {
      return res.status(400).json({
        error: { message: 'project_id is required in query parameters', status: 400 }
      });
    }

    const backupType = req.body.backup_type || 'full';
    const backup = await backupService.createBackup(req.params.name, projectId, backupType);

    res.status(201).json({
      success: true,
      backup
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

/**
 * POST /api/databases/:name/backups/:backupId/restore - Restore from backup
 */
router.post('/:name/backups/:backupId/restore', validateServiceToken, async (req, res, next) => {
  try {
    if (!databaseService || !backupService) {
      return res.status(503).json({
        error: { message: 'Database service not initialized', status: 503 }
      });
    }

    const projectId = req.query.project_id;
    if (!projectId) {
      return res.status(400).json({
        error: { message: 'project_id is required in query parameters', status: 400 }
      });
    }

    const result = await backupService.restoreBackup(req.params.name, projectId, req.params.backupId);

    res.json({
      success: true,
      ...result
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

/**
 * GET /api/databases/:name/health - Check database health
 */
router.get('/:name/health', validateServiceToken, async (req, res, next) => {
  try {
    if (!databaseService) {
      return res.status(503).json({
        error: { message: 'Database service not initialized', status: 503 }
      });
    }

    // Extract projectId from query params (required)
    const projectId = req.query.project_id;
    if (!projectId) {
      return res.status(400).json({
        error: { message: 'project_id is required in query parameters', status: 400 }
      });
    }

    const { name } = req.params;
    const health = await databaseService.checkHealth(name, projectId);
    
    res.status(health.healthy ? 200 : 503).json({
      healthy: health.healthy,
      message: health.message,
      database: name,
      timestamp: new Date().toISOString()
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

/**
 * GET /api/databases/:name/volumes - Get volume information
 */
router.get('/:name/volumes', validateServiceToken, async (req, res, next) => {
  try {
    if (!databaseService) {
      return res.status(503).json({
        error: { message: 'Database service not initialized', status: 503 }
      });
    }

    const projectId = req.query.project_id;
    if (!projectId) {
      return res.status(400).json({
        error: { message: 'project_id is required in query parameters', status: 400 }
      });
    }

    const dbInstance = await databaseService.getDatabase(req.params.name, projectId);
    
    // Get volume name from InstanceService
    const InstanceService = require('../services/InstanceService');
    const instanceService = new InstanceService();
    const projectName = await databaseService.getProjectName(projectId);
    const volumeName = instanceService.getVolumeName(dbInstance.name, projectName);

    // Parse storage config from metadata
    let storageConfig = null;
    try {
      const metadata = JSON.parse(dbInstance.metadata || '{}');
      storageConfig = metadata.storage || null;
    } catch (error) {
      // Ignore parse errors
    }

    // Get mount path based on database type
    const mountPaths = {
      postgresql: '/var/lib/postgresql/data',
      mongodb: '/data/db',
      neo4j: '/data',
      elasticsearch: '/usr/share/elasticsearch/data',
      redis: '/data'
    };

    res.json({
      database_name: dbInstance.name,
      volume_name: volumeName,
      storage_type: storageConfig?.type || 'volume',
      storage_location: storageConfig?.location || null,
      mount_path: mountPaths[dbInstance.type] || '/data',
      container_name: dbInstance.container_name
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
module.exports.initializeDatabaseService = initializeDatabaseService;
