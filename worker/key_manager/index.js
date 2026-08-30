require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { registerWithConductor } = require('./api/utils/serviceRegistration');
const keyRoutes = require('./api/routes/keys');
const errorHandler = require('./api/middleware/errorHandler');
const validateServiceToken = require('./api/middleware/auth');
const { db } = require('./api/models');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const { setupPrometheus } = require('../shared/simplePrometheusMetrics');
setupPrometheus(app, { serviceName: 'key_manager' });

// Initialize key service with master key
const masterKey = process.env.MASTER_KEY;
if (!masterKey) {
  console.error('[key_manager] ERROR: MASTER_KEY not set. Cannot start service.');
  process.exit(1);
}
if (process.env.NODE_ENV === 'production' && /^0+$/.test(String(masterKey))) {
  console.error('[key_manager] ERROR: MASTER_KEY is an all-zero dummy. Refusing to start in production.');
  process.exit(1);
}

// Initialize key service
keyRoutes.initializeKeyService(masterKey);

// Health checks (no auth required)
app.get('/health', async (req, res) => {
  try {
    // Check database connectivity
    const health = await db.healthCheck();
    
    if (!health.healthy) {
      return res.status(503).json({
        status: 'unhealthy',
        error: health.error || 'Database connection failed'
      });
    }
    
    res.status(200).json({
      status: 'healthy',
      service: process.env.SERVICE_NAME || 'key_manager',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

app.get('/ready', async (req, res) => {
  try {
    // Check database connectivity
    const health = await db.healthCheck();
    
    if (!health.healthy) {
      return res.status(503).json({ 
        status: 'not ready', 
        reason: 'Database not available',
        error: health.error
      });
    }
    
    // Check master key is loaded
    if (!process.env.MASTER_KEY) {
      return res.status(503).json({ 
        status: 'not ready', 
        reason: 'Master key not loaded' 
      });
    }
    
    res.status(200).json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({ 
      status: 'not ready', 
      error: error.message 
    });
  }
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    const { Key } = require('./api/models');
    const allKeys = await Key.findAll();
    const activeKeys = allKeys.filter(k => k.is_active === 1);
    
    res.json({
      keys_total: allKeys.length,
      keys_active: activeKeys.length,
      keys_archived: allKeys.length - activeKeys.length,
      service: process.env.SERVICE_NAME || 'key_manager',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: { message: error.message, status: 500 }
    });
  }
});

// API routes (require authentication)
app.use('/api', validateServiceToken);
app.use('/api/keys', keyRoutes);

// Error handling
app.use(errorHandler);

// Start server
async function startService() {
  try {
    // Register with conductor first
    await registerWithConductor();
    
    // Start Express server
    app.listen(PORT, () => {
      console.log(`[key_manager] Server running on port ${PORT}`);
      console.log(`[key_manager] Master key loaded: ${masterKey ? 'Yes' : 'No'}`);
      console.log(`[key_manager] Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('[key_manager] Failed to start service:', error);
    // Don't exit if registration fails - service can still run
    // Other services may stub calls during development
    app.listen(PORT, () => {
      console.log(`[key_manager] Server running on port ${PORT} (without conductor registration)`);
      console.log(`[key_manager] Master key loaded: ${masterKey ? 'Yes' : 'No'}`);
      console.log(`[key_manager] Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  }
}

startService();
