require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { registerWithConductor } = require('./api/utils/serviceRegistration');
const databaseRoutes = require('./api/routes/databases');
const metaRoutes = require('./api/routes/meta');
const errorHandler = require('./api/middleware/errorHandler');
const EncryptionService = require('./api/services/EncryptionService');
const { db } = require('./api/models');
const dbConnection = require('./api/utils/dbClient');

const app = express();
const PORT = process.env.PORT || 3004;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const { setupPrometheus } = require('../shared/simplePrometheusMetrics');
setupPrometheus(app, { serviceName: 'db_manager' });

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database connectivity
    // dbConnection is the connection object from aerekos-record which has healthCheck method
    const health = await dbConnection.healthCheck();
    
    if (!health.healthy) {
      return res.status(503).json({
        status: 'unhealthy',
        error: health.error || 'Database connection failed',
        timestamp: new Date().toISOString()
      });
    }
    
    res.status(200).json({
      status: 'healthy',
      service: process.env.SERVICE_NAME || 'db_manager',
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
    // key_manager is required unless MOCK_KEY_MANAGER (dev/tests only; refused when NODE_ENV=production)
    if (process.env.MOCK_KEY_MANAGER !== 'true' && process.env.CONDUCTOR_URL) {
      try {
        const projectId = process.env.PROJECT_ID;
        const url = projectId 
          ? `${process.env.CONDUCTOR_URL}/api/services/key_manager/health?project_id=${projectId}`
          : `${process.env.CONDUCTOR_URL}/api/services/key_manager/health`;
        
        const headers = {};
        if (process.env.SERVICE_TOKEN) {
          headers['Authorization'] = `Bearer ${process.env.SERVICE_TOKEN}`;
        }
        
        const response = await axios.get(url, { 
          headers,
          timeout: 3000 
        });
        if (response.data.status !== 'healthy') {
          throw new Error('key_manager is not healthy');
        }
      } catch (error) {
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

// Service metadata (no auth; matches OpenAPI CORE_GA /api/info)
app.use('/api', metaRoutes);

// API routes (require authentication)
app.use('/api/databases', databaseRoutes);

// Error handling middleware
app.use(errorHandler);

// Start server
async function startService() {
  try {
    if (process.env.NODE_ENV === 'production' && process.env.MOCK_KEY_MANAGER === 'true') {
      console.error('[db_manager] MOCK_KEY_MANAGER cannot be enabled when NODE_ENV=production');
      process.exit(1);
    }
    // Check CONDUCTOR_URL is set (REQUIRED)
    if (!process.env.CONDUCTOR_URL) {
      console.error('[db_manager] ERROR: CONDUCTOR_URL not set. Cannot connect to key_manager.');
      process.exit(1);
    }
    
    // Register with conductor first to get service token for authentication
    let serviceToken = null;
    try {
      const registration = await registerWithConductor();
      if (registration && registration.service_token) {
        serviceToken = registration.service_token;
        process.env.SERVICE_TOKEN = serviceToken;
        console.log('[db_manager] Registered with conductor and received service token');
      } else {
        throw new Error('Service registration did not return a service token');
      }
    } catch (error) {
      console.error('[db_manager] Service registration failed:', error.message);
      console.error('[db_manager] ERROR: Service token is required to authenticate with key_manager');
      process.exit(1);
    }
    
    // Get projectId from environment (required for project-scoped services)
    const projectId = process.env.PROJECT_ID;
    if (!projectId) {
      console.warn('[db_manager] PROJECT_ID not set; sqlite3/lancedb provision is still available (homelab).');
    } else {
      try {
        console.log(`[db_manager] Checking key_manager availability through conductor for project ${projectId}...`);
        const url = `${process.env.CONDUCTOR_URL}/api/services/key_manager/health?project_id=${projectId}`;
        const response = await axios.get(url, {
          headers: { Authorization: `Bearer ${serviceToken}` },
          timeout: 5000,
        });
        if (response.data.status !== 'healthy') {
          throw new Error('key_manager is not healthy');
        }
        console.log('[db_manager] key_manager is available and healthy');
        const encryptionService = new EncryptionService(process.env.CONDUCTOR_URL, serviceToken);
        await encryptionService.ensureEncryptionKey('db-manager-encryption-key', projectId);
        console.log(`[db_manager] Encryption key verified for project ${projectId}`);
      } catch (error) {
        console.error('[db_manager] key_manager/encryption check failed:', error.message);
        if (process.env.AUTH_REQUIRED === 'true') {
          process.exit(1);
        }
        console.warn('[db_manager] AUTH_REQUIRED is not true — listening anyway (homelab / local-dev)');
      }
    }
    
    // Initialize database service with conductor URL and token
    databaseRoutes.initializeDatabaseService(
      process.env.CONDUCTOR_URL,
      serviceToken
    );
    console.log('[db_manager] Database service initialized');
    
    // Initialize database models
    console.log('[db_manager] Initializing database models...');
    // Models are already loaded via require
    
    // Start Express server
    app.listen(PORT, () => {
      console.log(`[db_manager] Server running on port ${PORT}`);
      console.log(`[db_manager] Health check: http://localhost:${PORT}/health`);
      console.log(`[db_manager] Ready check: http://localhost:${PORT}/ready`);
    });
  } catch (error) {
    console.error('[db_manager] Failed to start:', error);
    process.exit(1);
  }
}

startService();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[db_manager] SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[db_manager] SIGINT received, shutting down gracefully');
  process.exit(0);
});
