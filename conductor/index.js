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
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request ID middleware (for correlation tracking)
const requestIdMiddleware = require('./api/middleware/requestId');
app.use(requestIdMiddleware);

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

// API v1 routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/token', tokenRoutes);
app.use('/api/v1/workers', workerRoutes);

// Legacy routes (for backward compatibility)
app.use('/api/auth', authRoutes);
app.use('/api/token', tokenRoutes);
app.use('/api/workers', workerRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      status: err.status || 500
    }
  });
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
    await initializeDatabase();
    
    // Seed default admin user if no users exist (skip in test mode)
    if (process.env.NODE_ENV !== 'test') {
      const UserRepository = require('./api/repos/UserRepository');
      const users = await UserRepository.findAll();
      if (users.length === 0) {
        console.log('No users found, seeding default admin user (username: admin, password: admin)...');
        const { seedUsers } = require('./scripts/seedUsers');
        await seedUsers();
        console.log('✓ Default admin user created successfully');
      }
    }
    
    // Generate registration token if none exists (skip in test mode)
    if (process.env.NODE_ENV !== 'test') {
      const TokenService = require('./api/services/TokenService');
      const currentToken = await TokenService.getCurrentToken();
      if (!currentToken) {
        const newToken = await TokenService.generateRegistrationToken();
        console.log(`Generated registration token: ${newToken}`);
      } else {
        console.log(`Using existing registration token`);
      }
    }
    
    // Initialize WebSocket server
    WorkerSocketService.initialize(server);

    server.listen(PORT, () => {
      console.log(`Conductor API server running on port ${PORT}`);
      console.log(`WebSocket server initialized`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Database: ${process.env.DATABASE_PATH || './data/conductor.db'}`);
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
