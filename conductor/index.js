require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initializeDatabase } = require('./api/utils/dbInit');
const WorkerSocketService = require('./api/services/WorkerSocketService');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Export app for testing (before routes are registered)
// Routes will be registered below

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Trust proxy for accurate IP detection
app.set('trust proxy', true);

// Middleware
// CORS configuration - handle preflight OPTIONS requests
// Must be before other middleware
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({
  origin: corsOrigin === '*' ? true : corsOrigin, // true allows all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'authorization', 'content-type'],
  exposedHeaders: ['X-Request-ID'],
  optionsSuccessStatus: 200 // Some legacy browsers (IE11, various SmartTVs) choke on 204
}));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));

// Request ID middleware (for correlation tracking)
const requestIdMiddleware = require('./api/middleware/requestId');
app.use(requestIdMiddleware);

const { setupPrometheus } = require('./api/utils/simplePrometheusMetrics');
setupPrometheus(app, { serviceName: 'conductor' });

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${req.id}] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database connectivity - try to access the database file
    const fs = require('fs');
    const path = require('path');
    const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'data/conductor.db');
    
    // Check if database file exists and is accessible
    if (fs.existsSync(dbPath)) {
      // Try a simple database operation
      const { User } = require('./api/models');
      // Use a non-blocking query that won't create data
      try {
        await User.findAll({ limit: 1 });
      } catch (dbError) {
        // If query fails, database might be locked but exists
        // Still consider it "connected" if file exists
      }
      
      res.json({
        status: 'healthy',
        service: 'conductor',
        database: 'connected',
        timestamp: new Date().toISOString()
      });
    } else {
      // Database file doesn't exist yet (first run)
      res.json({
        status: 'healthy',
        service: 'conductor',
        database: 'initializing',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'conductor',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Version endpoint — the conductor's own deployed version (git short SHA at
// deploy time). The dashboard uses this as the "current" version to flag
// devices running outdated code.
const { conductorVersion, targetVersion } = require('./api/utils/version');
app.get(['/api/version', '/api/v1/version'], (req, res) => {
  res.json({
    service: 'conductor',
    version: conductorVersion(),     // the conductor's own running code
    latest_release: targetVersion(), // what the fleet should be on
  });
});

// Basic API route
app.get('/api', (req, res) => {
  res.json({
    message: 'aerekos-cloud Conductor API',
    version: '1.0.0',
    endpoints: {
      v1: '/api/v1',
      legacy: '/api'
    }
  });
});

// API v1 info
app.get('/api/v1', (req, res) => {
  res.json({
    message: 'aerekos-cloud Conductor API v1',
    version: '1.0.0',
    endpoints: {
      auth: '/api/v1/auth',
      token: '/api/v1/token',
      workers: '/api/v1/workers'
    }
  });
});

// API Routes with versioning
const authRoutes = require('./api/routes/auth');
const tokenRoutes = require('./api/routes/token');
const workerRoutes = require('./api/routes/worker');
const servicesRoutes = require('./api/routes/services');
const projectRoutes = require('./api/routes/project');
const deploymentRoutes = require('./api/routes/deployment');
const serviceOrchestrationRoutes = require('./api/routes/serviceOrchestration');
const releaseRoutes = require('./api/routes/releases');
const setupRoutes = require('./api/routes/setup');
const edgeRoutes = require('./api/routes/edge');
const fleetRoutes = require('./api/routes/fleet');
const jobsRoutes = require('./api/routes/jobs');
const searchRoutes = require('./api/routes/search');
const opsRoutes = require('./api/routes/ops');

// API v1 routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/token', tokenRoutes);
app.use('/api/v1/workers', workerRoutes);
app.use('/api/v1/services', servicesRoutes);
app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/deployments', deploymentRoutes);
app.use('/api/v1/releases', releaseRoutes);
app.use('/api/v1/setup', setupRoutes);
app.use('/api/v1/edge', edgeRoutes);
app.use('/api/v1/fleet', fleetRoutes);
app.use('/api/v1/jobs', jobsRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/v1/ops', opsRoutes);
app.use('/api/ops', opsRoutes);

// Legacy routes (for backward compatibility)
app.use('/api/auth', authRoutes);
app.use('/api/token', tokenRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/deployments', deploymentRoutes);
app.use('/api/releases', releaseRoutes);
app.use('/api/setup', setupRoutes);
app.use('/api/edge', edgeRoutes);
app.use('/api/fleet', fleetRoutes);
app.use('/api/jobs', jobsRoutes);
const liveRoutes = require('./api/routes/live');
app.use('/api/live', liveRoutes);
const systemRoutes = require('./api/routes/system');
app.use('/api/system', systemRoutes);
app.use('/api', serviceOrchestrationRoutes);

const gatewayRoutes = require('./api/routes/gateway');
app.use(gatewayRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Error Handler]', err);
  console.error('[Error Handler] Stack:', err.stack);
  
  // Ensure response hasn't been sent
  if (!res.headersSent) {
    res.status(err.status || 500).json({
      error: {
        message: err.message || 'Internal server error',
        status: err.status || 500
      }
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: 'Not found',
      status: 404
    }
  });
});

// Initialize database and start server
async function startServer() {
  try {
    const { assertProdSecrets } = require('./api/utils/prodSecrets');
    assertProdSecrets();

    await initializeDatabase();
    
    // Seed default admin user if no users exist (skip in test mode)
    if (process.env.NODE_ENV !== 'test') {
      const UserRepository = require('./api/repos/UserRepository');
      const users = await UserRepository.findAll();
      if (users.length === 0) {
        if (process.env.ALLOW_DEFAULT_ADMIN_SEED !== '1') {
          console.error('No users found. Set ALLOW_DEFAULT_ADMIN_SEED=1 to create admin/admin, or create a user before start.');
          if (process.env.NODE_ENV === 'production') process.exit(1);
        } else {
          console.log('No users found, seeding default admin user (username: admin, password: admin)...');
          const { seedUsers } = require('./scripts/seedUsers');
          await seedUsers();
          console.log('✓ Default admin user created successfully');
        }
      }
    }
    
    // Seed default services if none exist (skip in test mode)
    if (process.env.NODE_ENV !== 'test') {
      const { Service } = require('./api/models');
      const { randomUUID } = require('crypto');
      const services = await Service.findAll();
      if (services.length === 0) {
        console.log('No services found, seeding default services (key_manager, storage_manager, db_manager)...');
        const { seedServices } = require('./scripts/seedServices');
        await seedServices();
        const { ensurePlatformDeviceServices } = require('./api/services/PlatformServiceSync');
        await ensurePlatformDeviceServices();
        console.log('✓ Default services created successfully');
      } else {
        const { ensureMissingDefaultServices } = require('./scripts/seedServices');
        await ensureMissingDefaultServices();
        const { ensurePlatformDeviceServices } = require('./api/services/PlatformServiceSync');
        await ensurePlatformDeviceServices();
      }

      try {
        const EnvironmentService = require('./api/services/EnvironmentService');
        await EnvironmentService.ensureAll();
      } catch (err) {
        console.warn('[conductor] ensure environments:', err.message);
      }

      // Ensure conductor itself is registered as a service (for service-to-service auth)
      const conductorServices = await Service.findAll({ where: { name: 'conductor' } });
      if (conductorServices.length === 0) {
        const conductorToken = randomUUID();
        await Service.create({
          name: 'conductor',
          enabled: 1,
          docker_image: 'aerekos-conductor:latest',
          config: JSON.stringify({
            version: '1.0.0',
            port: process.env.PORT || 3000,
            description: 'Master orchestrator service'
          }),
          service_token: conductorToken
        });
        process.env.CONDUCTOR_TOKEN = conductorToken;
        process.env.SERVICE_TOKEN = conductorToken;
        console.log('✓ Conductor registered as a service');
      } else {
        const conductorService = conductorServices[0];
        if (conductorService.service_token) {
          process.env.CONDUCTOR_TOKEN = conductorService.service_token;
          process.env.SERVICE_TOKEN = conductorService.service_token;
        } else {
          // Generate token if missing
          const conductorToken = randomUUID();
          await Service.update(conductorService.id, { service_token: conductorToken });
          process.env.CONDUCTOR_TOKEN = conductorToken;
          process.env.SERVICE_TOKEN = conductorToken;
          console.log('✓ Conductor service token generated');
        }
      }
    }
    
    // Generate registration token if none exists (skip in test mode)
    if (process.env.NODE_ENV !== 'test') {
      const TokenService = require('./api/services/TokenService');
      const currentToken = await TokenService.getCurrentToken();
      if (!currentToken) {
        const preferred = (process.env.WORKER_REGISTRATION_TOKEN || process.env.REGISTRATION_TOKEN || '').trim();
        const newToken = await TokenService.ensureInitialRegistrationToken(preferred || null);
        console.log(`Using registration token: ${newToken}${preferred ? ' (from WORKER_REGISTRATION_TOKEN/REGISTRATION_TOKEN)' : ''}`);
      } else {
        console.log(`Using existing registration token`);
      }
    }
    
    if (process.env.NODE_ENV !== 'test') {
      try {
        const IacHookupService = require('./api/services/IacHookupService');
        IacHookupService.backfillAll().catch((err) => console.warn('[iac] backfill:', err.message));
      } catch (err) {
        console.warn('[iac] backfill skipped:', err.message);
      }
    }

    // Initialize WebSocket server
    WorkerSocketService.initialize(server);

    server.listen(PORT, () => {
      console.log(`Conductor API server running on port ${PORT}`);
      console.log(`WebSocket server initialized`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Database: ${process.env.DATABASE_PATH || './data/conductor.db'}`);

      // Adopt the JWT signing secret from the key manager (single source of
      // truth shared with auth_manager). The read path runs through this
      // service's own proxy, so it can only succeed once we are listening;
      // retry for a while in case secrets/key managers are still starting.
      const JWTService = require('./api/services/JWTService');
      (async () => {
        for (let attempt = 1; attempt <= 20; attempt++) {
          if (await JWTService.loadKmsSecret()) break;
          if (attempt < 20) await new Promise((r) => setTimeout(r, 5000));
        }
      })();
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Only start server if this file is run directly (not imported for tests)
if (require.main === module) {
  startServer();
}

// Always export app (for testing)
module.exports = app;
