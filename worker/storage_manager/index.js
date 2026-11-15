require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { registerWithConductor } = require('./api/utils/serviceRegistration');
const { getDatabase } = require('./api/utils/dbClient');
const { initializeModels } = require('./api/models');
const metaRoutes = require('./api/routes/meta');
const projectRoutes = require('./api/routes/projects');
const bucketRoutes = require('./api/routes/buckets');
const signedUrlRoutes = require('./api/routes/signedUrls');
const chunkedUploadRoutes = require('./api/routes/chunkedUploads');
const fileRoutes = require('./api/routes/files');
const systemBucketRoutes = require('./api/routes/systemBuckets');
const systemFileRoutes = require('./api/routes/systemFiles');
const { ensureBucketSystemColumns, ensureBucketArnColumn } = require('./api/utils/migrations');
const errorHandler = require('./api/middleware/errorHandler');
const logger = require('./api/utils/logger');

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(cors());

// Full request trail: request line, then status + duration (+JSON body).
app.use((req, res, next) => {
  const start = Date.now();
  const now = () => new Date().toISOString();
  const quiet =
    req.path.startsWith('/health') ||
    req.path.startsWith('/ready') ||
    req.path.startsWith('/metrics') ||
    req.path === '/api/info';
  if (!quiet) console.log(`[${now()}] --> ${req.method} ${req.path}${req.search || ''}`);
  res.on('finish', () => {
    let bodyLog = '';
    if (req.method !== 'GET' && req.body && typeof req.body === 'object') {
      try {
        let s = JSON.stringify(req.body);
        if (s.length > 2000) s = s.slice(0, 2000) + '…';
        bodyLog = ' body=' + s;
      } catch (e) { bodyLog = ' body=<unserializable>'; }
    }
    if (!quiet) console.log(`[${now()}] <-- ${req.method} ${req.originalUrl || req.path} ${res.statusCode} ${Date.now() - start}ms${bodyLog}`);
  });
  next();
});

const { setupPrometheus } = require('../shared/simplePrometheusMetrics');
setupPrometheus(app, { serviceName: 'storage_manager' });

// Register signed URL routes FIRST (before body parsing) so they can handle raw streams
// This route handles: /api/services/storage_manager/signed/:signature/:fileId/:bucketId/:urlType
app.use('/api/services/storage_manager', signedUrlRoutes);

// Skip JSON parsing for signed URL routes (they handle binary uploads)
app.use((req, res, next) => {
  if (req.path && (req.path.includes('/signed/') || req.originalUrl.includes('/signed/'))) {
    // Skip body parsing for signed URLs - they handle binary streams
    return next();
  }
  // Apply JSON parsing for other routes
  express.json({ limit: '10gb' })(req, res, next);
});

app.use((req, res, next) => {
  if (req.path && (req.path.includes('/signed/') || req.originalUrl.includes('/signed/'))) {
    // Skip URL encoding for signed URLs
    return next();
  }
  express.urlencoded({ extended: true, limit: '10gb' })(req, res, next);
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database connectivity
    const db = await getDatabase();
    await db.healthCheck();
    
    // Check storage directory is writable
    const storagePath = process.env.STORAGE_PATH || './storage';
    try {
      await fs.promises.access(storagePath, fs.constants.W_OK);
    } catch {
      await fs.promises.mkdir(storagePath, { recursive: true });
    }
    
    res.status(200).json({
      status: 'healthy',
      service: process.env.SERVICE_NAME || 'storage_manager',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Readiness check endpoint
app.get('/ready', async (req, res) => {
  try {
    // Check database is ready
    const db = await getDatabase();
    await db.healthCheck();
    
    // Check storage directory is accessible
    const storagePath = process.env.STORAGE_PATH || './storage';
    await fs.promises.access(storagePath, fs.constants.W_OK);
    
    // Check key_manager is accessible (REQUIRED)
    if (!process.env.CONDUCTOR_URL) {
      logger.error('[ready] CONDUCTOR_URL not set');
      return res.status(503).json({
        status: 'not ready',
        error: 'CONDUCTOR_URL not configured',
        timestamp: new Date().toISOString()
      });
    }
    
    const axios = require('axios');
    if (process.env.MOCK_KEY_MANAGER === 'true') {
      // Dev-only: encryption uses local mock material; key_manager not contacted
    } else {
      try {
        if (!process.env.SERVICE_TOKEN) {
          return res.status(503).json({
            status: 'not ready',
            error: 'Service token not available',
            timestamp: new Date().toISOString()
          });
        }

        const projectId = process.env.PROJECT_ID;
        const url = projectId
          ? `${process.env.CONDUCTOR_URL}/api/services/key_manager/health?project_id=${projectId}`
          : `${process.env.CONDUCTOR_URL}/api/services/key_manager/health`;

        const response = await axios.get(url, {
          headers: {
            Authorization: `Bearer ${process.env.SERVICE_TOKEN}`
          },
          timeout: 3000
        });

        if (response.data.status !== 'healthy') {
          throw new Error('key_manager is not healthy');
        }
      } catch (error) {
        logger.error('[ready] key_manager is REQUIRED but not accessible');
        return res.status(503).json({
          status: 'not ready',
          error: 'key_manager is required but not accessible',
          timestamp: new Date().toISOString()
        });
      }
    }
    
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    const { getModels } = require('./api/models');
    const { Bucket, File } = await getModels();
    
    const buckets = await Bucket.findAll();
    const files = await File.findAll();
    
    // Calculate storage usage
    let totalStorage = 0;
    for (const file of files) {
      totalStorage += file.size || 0;
    }
    
    res.json({
      buckets: buckets.length,
      files: files.length,
      storage_bytes: totalStorage,
      storage_gb: (totalStorage / (1024 * 1024 * 1024)).toFixed(2)
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

// Service metadata (no auth; matches OpenAPI CORE_GA /api/info)
app.use('/api', metaRoutes);

// API routes
app.get('/api/storage-classes', (_req, res) => {
  res.json({
    classes: [
      { name: 'standard', analog: 'S3 Standard', default: true },
      { name: 'infrequent', analog: 'S3 Infrequent Access' },
      { name: 'archive', analog: 'Glacier' },
    ],
  });
});
app.use('/api/projects', projectRoutes);
app.use('/api/projects', bucketRoutes);
app.use('/api/projects', signedUrlRoutes); // Must come before fileRoutes
app.use('/api/projects', chunkedUploadRoutes);
app.use('/api/projects', fileRoutes);
app.use('/api/systems', systemBucketRoutes);
app.use('/api/systems', systemFileRoutes);

// Error handling
app.use(errorHandler);

// Start server
async function startService() {
  try {
    if (process.env.NODE_ENV === 'production' && process.env.MOCK_KEY_MANAGER === 'true') {
      logger.error('[storage_manager] MOCK_KEY_MANAGER cannot be enabled when NODE_ENV=production');
      process.exit(1);
    }

    // Check key_manager is available (REQUIRED)
    if (!process.env.CONDUCTOR_URL) {
      logger.error('[storage_manager] ERROR: CONDUCTOR_URL not set. Cannot connect to key_manager.');
      process.exit(1);
    }
    
    // Initialize database, run lightweight column migrations, then models
    logger.info('[storage_manager] Initializing database...');
    await getDatabase();
    ensureBucketSystemColumns();
    ensureBucketArnColumn();
    await initializeModels();
    logger.info('[storage_manager] Database initialized');
    
    // Register with conductor first to get service token for authentication
    let serviceToken = null;
    try {
      const registration = await registerWithConductor();
      if (registration && registration.service_token) {
        serviceToken = registration.service_token;
        process.env.SERVICE_TOKEN = serviceToken;
        logger.info('[storage_manager] Registered with conductor and received service token');
        
        // Initialize bucket service with conductor URL and token
        const bucketRoutes = require('./api/routes/buckets');
        bucketRoutes.initializeBucketService(
          process.env.CONDUCTOR_URL,
          serviceToken
        );
        const systemBucketRoutes = require('./api/routes/systemBuckets');
        systemBucketRoutes.initializeSystemBucketService(
          process.env.CONDUCTOR_URL,
          serviceToken
        );
      }
    } catch (error) {
      logger.warn('[storage_manager] Service registration failed:', error.message);
      // Continue - we'll try to check health anyway
    }
    
    const axios = require('axios');
    if (process.env.MOCK_KEY_MANAGER === 'true') {
      logger.warn('[storage_manager] MOCK_KEY_MANAGER=true — skipping key_manager health check (not for production)');
    } else {
      try {
        logger.info('[storage_manager] Checking key_manager availability through conductor...');

        if (!serviceToken) {
          throw new Error('Service token required to authenticate with conductor');
        }

        const projectId = process.env.PROJECT_ID;
        const url = projectId
          ? `${process.env.CONDUCTOR_URL}/api/services/key_manager/health?project_id=${projectId}`
          : `${process.env.CONDUCTOR_URL}/api/services/key_manager/health`;

        const response = await axios.get(url, {
          headers: {
            Authorization: `Bearer ${serviceToken}`
          },
          timeout: 5000
        });

        if (response.data.status !== 'healthy') {
          throw new Error('key_manager is not healthy');
        }
        logger.info('[storage_manager] key_manager is available and healthy');
      } catch (error) {
        if (error.response?.status === 401) {
          logger.error('[storage_manager] ERROR: Authentication failed when checking key_manager health');
          logger.error('[storage_manager] Service token may be invalid or missing');
        }
        logger.error('[storage_manager] ERROR: key_manager is REQUIRED but not accessible');
        logger.error(`[storage_manager] key_manager health check failed: ${error.message}`);
        if (process.env.AUTH_REQUIRED === 'true') {
          process.exit(1);
        }
        logger.warn('[storage_manager] AUTH_REQUIRED is not true — listening anyway (homelab / local-dev)');
      }
    }
    
    // Start server
    app.listen(PORT, () => {
      logger.info(`[storage_manager] Server running on port ${PORT}`);
      logger.info(`[storage_manager] Health check: http://localhost:${PORT}/health`);
      logger.info(`[storage_manager] Ready check: http://localhost:${PORT}/ready`);
    });
  } catch (error) {
    logger.error('[storage_manager] Failed to start:', error);
    process.exit(1);
  }
}

startService();

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('[storage_manager] SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('[storage_manager] SIGINT received, shutting down gracefully');
  process.exit(0);
});
