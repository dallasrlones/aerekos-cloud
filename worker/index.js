require('dotenv').config();
const express = require('express');
const cors = require('cors');
const os = require('os');
const ConductorService = require('./api/services/ConductorService');
const ConductorSocketService = require('./api/services/ConductorSocketService');
const ResourceDetector = require('./utils/resourceDetector');
const ServiceManager = require('./docker/ServiceManager');
const DeploymentHandler = require('./services/DeploymentHandler');
const { getStoredWorkerId, storeWorkerId, clearWorkerId } = require('./utils/workerIdStorage');

const app = express();
const PORT = process.env.PORT || 3001;

// Configuration
const CONDUCTOR_URL = process.env.CONDUCTOR_URL || 'http://localhost:3000';
const CONDUCTOR_TOKEN = process.env.CONDUCTOR_TOKEN;
const HEARTBEAT_INTERVAL = parseInt(process.env.HEARTBEAT_INTERVAL || '30', 10) * 1000; // Convert to ms (for fallback)
const RESOURCE_CHECK_INTERVAL = parseInt(process.env.RESOURCE_CHECK_INTERVAL || '60', 10) * 1000; // Convert to ms
const DEPLOYMENT_CHECK_INTERVAL = parseInt(process.env.DEPLOYMENT_CHECK_INTERVAL || '10', 10) * 1000; // Convert to ms
const SERVICE_STATUS_INTERVAL = parseInt(process.env.SERVICE_STATUS_INTERVAL || '30', 10) * 1000; // Convert to ms

// Worker identity (set by conductor during registration, stored in memory)
let WORKER_HOSTNAME = null;
let WORKER_IP = null;

// Initialize services
const conductorService = new ConductorService(CONDUCTOR_URL);
const conductorSocket = new ConductorSocketService(CONDUCTOR_URL);
const resourceDetector = ResourceDetector;
const deploymentHandler = new DeploymentHandler(conductorService);

// Set up reconnect handler to re-register worker when socket reconnects
conductorSocket.setOnReconnect(() => {
  console.log('Socket reconnected - re-registering worker...');
  isRegistered = false;
  registerWorker();
});

// State
let isRegistered = false;
let registrationAttempts = 0;
const MAX_REGISTRATION_ATTEMPTS = 5;
let heartbeatInterval = null;
let resourceCheckInterval = null;
let deploymentCheckInterval = null;
let serviceStatusInterval = null;
let lastResources = null;
let dockerConnected = false;

// Middleware
app.use(cors());
app.use(express.json());

/**
 * Get actual device hostname and IP
 * Uses environment variables set by entrypoint script (preferred)
 * Falls back to detection if not set
 * @returns {Promise<{hostname: string, ip: string}>} Device hostname and IP
 */
async function getDeviceInfo() {
  // Priority 1: Use environment variables from entrypoint script
  let hostname = process.env.WORKER_HOSTNAME;
  let ip = process.env.WORKER_IP;

  if (hostname && ip) {
    console.log(`Using device info from entrypoint - Hostname: ${hostname}, IP: ${ip}`);
    return { hostname, ip };
  }

  // Priority 2: Fallback detection (should rarely be needed)
  console.warn('⚠️  Hostname/IP not set by entrypoint, using fallback detection');
  
  if (!hostname) {
    hostname = os.hostname();
  }

  if (!ip) {
    // Try to get from network interfaces
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      // Skip Docker interfaces
      if (name.startsWith('docker') || name.startsWith('br-') || name.startsWith('veth')) {
        continue;
      }
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          ip = iface.address;
          break;
        }
      }
      if (ip) break;
    }
    ip = ip || '127.0.0.1';
  }

  return { hostname, ip };
}

/**
 * Register worker with conductor
 */
async function registerWorker() {
  if (!CONDUCTOR_TOKEN) {
    console.error('ERROR: CONDUCTOR_TOKEN is not set. Cannot register worker.');
    return false;
  }

  try {
    // Check for stored worker ID first
    const storedWorkerId = getStoredWorkerId();
    let worker = null;
    let isNewRegistration = false;

    if (storedWorkerId) {
      console.log(`Found stored worker ID: ${storedWorkerId}`);
      console.log('Verifying worker ID with conductor...');
      
      try {
        // Try to verify worker exists by attempting registration with existing ID
        // Connect WebSocket first
        if (!conductorSocket.getIsConnected()) {
          await conductorSocket.connect();
        }

        // Get initial resources
        const resources = await resourceDetector.getAllResources();
        lastResources = resources;

        // Get actual device hostname and IP (not Docker internal)
        const deviceInfo = await getDeviceInfo();
        
        // Try to register with existing worker ID
        worker = await conductorSocket.registerWorker(
          CONDUCTOR_TOKEN,
          deviceInfo.hostname,
          deviceInfo.ip,
          resources,
          storedWorkerId
        );
        
        console.log(`✓ Verified existing worker ID: ${worker.id}`);
      } catch (error) {
        console.log(`✗ Worker ID ${storedWorkerId} is invalid or not found: ${error.message}`);
        console.log('Clearing stored worker ID and registering as new worker...');
        clearWorkerId();
        isNewRegistration = true;
      }
    }

    // If no stored ID or verification failed, register as new worker
    if (!worker) {
      isNewRegistration = true;
      console.log(`Connecting to conductor via WebSocket at ${CONDUCTOR_URL}...`);

      // Connect WebSocket first
      if (!conductorSocket.getIsConnected()) {
        await conductorSocket.connect();
      }

      // Get initial resources
      const resources = await resourceDetector.getAllResources();
      lastResources = resources;

      // Get actual device hostname and IP (not Docker internal)
      const deviceInfo = await getDeviceInfo();
      console.log(`Detected device info - Hostname: ${deviceInfo.hostname}, IP: ${deviceInfo.ip}`);

      // Register with conductor via WebSocket (send actual device info)
      worker = await conductorSocket.registerWorker(
        CONDUCTOR_TOKEN,
        deviceInfo.hostname,
        deviceInfo.ip,
        resources
      );

      // Also register via HTTP for backward compatibility
      try {
        await conductorService.registerWorker(
          CONDUCTOR_TOKEN,
          deviceInfo.hostname,
          deviceInfo.ip,
          resources
        );
      } catch (httpError) {
        // HTTP registration is optional if WebSocket works
        console.warn('HTTP registration failed (using WebSocket only):', httpError.message);
      }
    }

    // Store worker ID to file for persistence
    storeWorkerId(worker.id);

    // Store IP and hostname returned by conductor (in memory only)
    WORKER_HOSTNAME = worker.hostname;
    WORKER_IP = worker.ip_address;

    console.log(`✓ Worker ${isNewRegistration ? 'registered' : 'verified'} successfully via WebSocket!`);
    console.log(`  Worker ID: ${worker.id}`);
    console.log(`  Hostname: ${WORKER_HOSTNAME}`);
    console.log(`  IP Address: ${WORKER_IP}`);
    console.log(`  Status: ${worker.status}`);

    isRegistered = true;
    registrationAttempts = 0;
    
    // Start WebSocket-based heartbeat
    startWebSocketHeartbeat();
    
    return true;
  } catch (error) {
    registrationAttempts++;
    console.error(`✗ Registration failed (attempt ${registrationAttempts}/${MAX_REGISTRATION_ATTEMPTS}):`, error.message);
    
    if (registrationAttempts >= MAX_REGISTRATION_ATTEMPTS) {
      console.error('Max registration attempts reached. Worker will not start.');
      return false;
    }

    // Retry after exponential backoff
    const retryDelay = Math.min(1000 * Math.pow(2, registrationAttempts), 30000); // Max 30 seconds
    console.log(`Retrying registration in ${retryDelay / 1000} seconds...`);
    setTimeout(registerWorker, retryDelay);
    return false;
  }
}

/**
 * Send heartbeat to conductor (WebSocket ping with resources)
 */
async function sendHeartbeat() {
  if (!isRegistered || !conductorSocket.getIsConnected()) {
    return;
  }

  try {
    // Get current resources for real-time monitoring (fresh read every heartbeat)
    const resources = await resourceDetector.getAllResources();
    
    // Send heartbeat with resources
    conductorSocket.sendPing({
      cpu_cores: resources.cpu_cores,
      ram_gb: resources.ram_gb,
      disk_gb: resources.disk_gb,
      network_mbps: resources.network_mbps,
      // Include detailed resource info
      cpu: resources.cpu,
      ram: resources.ram,
      disk: resources.disk,
      network: resources.network
    });
    
    // Update last resources for comparison
    lastResources = resources;
  } catch (error) {
    console.error(`✗ Heartbeat failed:`, error.message);
    
    // If disconnected, try to re-register
    if (!conductorSocket.getIsConnected()) {
      console.log('WebSocket disconnected. Attempting re-registration...');
      isRegistered = false;
      registerWorker();
    }
  }
}

/**
 * Start WebSocket-based heartbeat (replaces HTTP heartbeat)
 */
function startWebSocketHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  heartbeatInterval = setInterval(() => {
    sendHeartbeat();
  }, HEARTBEAT_INTERVAL);

  console.log(`WebSocket heartbeat started (interval: ${HEARTBEAT_INTERVAL / 1000}s)`);
}

/**
 * Check and update resources
 */
async function checkAndUpdateResources() {
  if (!isRegistered) {
    return;
  }

  try {
    const resources = await resourceDetector.getAllResources();
    
    // Only update if resources changed significantly (more than 5% change)
    if (lastResources) {
      const ramChanged = Math.abs(resources.ram_gb - lastResources.ram_gb) > (lastResources.ram_gb * 0.05);
      const diskChanged = Math.abs(resources.disk_gb - lastResources.disk_gb) > (lastResources.disk_gb * 0.05);
      
      if (!ramChanged && !diskChanged && resources.cpu_cores === lastResources.cpu_cores) {
        // Resources haven't changed significantly, skip update
        return;
      }
    }

    // Send resources via WebSocket (real-time)
    if (conductorSocket.getIsConnected()) {
      conductorSocket.sendResources({
        cpu_cores: resources.cpu_cores,
        ram_gb: resources.ram_gb,
        disk_gb: resources.disk_gb,
        network_mbps: resources.network_mbps
      });
    }
    
    // Also update via HTTP for backward compatibility
    try {
      await conductorService.updateResources({
        cpu_cores: resources.cpu_cores,
        ram_gb: resources.ram_gb,
        disk_gb: resources.disk_gb,
        network_mbps: resources.network_mbps
      });
    } catch (httpError) {
      // HTTP update is optional if WebSocket works
      if (!conductorSocket.getIsConnected()) {
        throw httpError; // Only throw if WebSocket also failed
      }
    }

    lastResources = resources;
    console.log(`✓ Resources updated: ${resources.cpu_cores} CPU cores, ${resources.ram_gb} GB RAM, ${resources.disk_gb} GB disk`);
  } catch (error) {
    console.error(`✗ Resource update failed:`, error.message);
    
    // If worker not found, try to re-register
    if (error.message.includes('re-registration required') || error.message.includes('Worker not found')) {
      console.log('Worker not found on conductor. Attempting re-registration...');
      isRegistered = false;
      await registerWorker();
    }
  }
}

/**
 * Start heartbeat loop
 */
function startHeartbeatLoop() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  heartbeatInterval = setInterval(() => {
    sendHeartbeat();
  }, HEARTBEAT_INTERVAL);

  console.log(`Heartbeat loop started (interval: ${HEARTBEAT_INTERVAL / 1000}s)`);
}

/**
 * Start resource check loop
 */
function startResourceCheckLoop() {
  if (resourceCheckInterval) {
    clearInterval(resourceCheckInterval);
  }

  resourceCheckInterval = setInterval(() => {
    checkAndUpdateResources();
  }, RESOURCE_CHECK_INTERVAL);

  console.log(`Resource check loop started (interval: ${RESOURCE_CHECK_INTERVAL / 1000}s)`);
}

/**
 * Check for deployment instructions from conductor
 */
async function checkDeploymentInstructions() {
  if (!isRegistered) {
    return;
  }

  try {
    const instructions = await conductorService.getDeploymentInstructions();
    
    if (instructions && instructions.length > 0) {
      for (const instruction of instructions) {
        console.log(`Received deployment instruction: ${instruction.action} for ${instruction.service}`);
        deploymentHandler.queueDeployment(instruction);
      }
    }
  } catch (error) {
    // Don't log errors for getDeploymentInstructions - it's expected to return empty array for now
    if (!error.message.includes('not implemented')) {
      console.error(`✗ Failed to check deployment instructions:`, error.message);
    }
  }
}

/**
 * Start deployment check loop
 */
function startDeploymentCheckLoop() {
  if (deploymentCheckInterval) {
    clearInterval(deploymentCheckInterval);
  }

  deploymentCheckInterval = setInterval(() => {
    checkDeploymentInstructions();
  }, DEPLOYMENT_CHECK_INTERVAL);

  console.log(`Deployment check loop started (interval: ${DEPLOYMENT_CHECK_INTERVAL / 1000}s)`);
}

/**
 * Monitor service status and report to conductor
 */
async function monitorServiceStatus() {
  if (!isRegistered) {
    return;
  }

  try {
    const services = await ServiceManager.listServices();
    
    for (const service of services) {
      const status = service.running ? 'running' : 'stopped';
      await conductorService.reportServiceStatus(service.service, status);
    }
  } catch (error) {
    console.error(`✗ Service status monitoring failed:`, error.message);
  }
}

/**
 * Start service status monitoring loop
 */
function startServiceStatusMonitoring() {
  if (serviceStatusInterval) {
    clearInterval(serviceStatusInterval);
  }

  serviceStatusInterval = setInterval(() => {
    monitorServiceStatus();
  }, SERVICE_STATUS_INTERVAL);

  console.log(`Service status monitoring started (interval: ${SERVICE_STATUS_INTERVAL / 1000}s)`);
}

/**
 * Check Docker connection
 */
async function checkDockerConnection() {
  try {
    dockerConnected = await ServiceManager.checkDockerConnection();
    if (!dockerConnected) {
      console.warn('⚠ Docker daemon not accessible. Container management will not work.');
    } else {
      console.log('✓ Docker daemon connected');
    }
  } catch (error) {
    console.error('✗ Docker connection check failed:', error);
    dockerConnected = false;
  }
}

/**
 * Graceful shutdown
 */
async function gracefulShutdown() {
  console.log('\nShutting down worker...');
  
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }
  
  if (resourceCheckInterval) {
    clearInterval(resourceCheckInterval);
  }

  if (deploymentCheckInterval) {
    clearInterval(deploymentCheckInterval);
  }

  if (serviceStatusInterval) {
    clearInterval(serviceStatusInterval);
  }

  // Stop all managed services
  if (dockerConnected) {
    try {
      const services = await ServiceManager.listServices();
      for (const service of services) {
        if (service.running) {
          try {
            await ServiceManager.stopService(service.service);
            console.log(`Stopped service: ${service.service}`);
          } catch (error) {
            console.error(`Failed to stop service ${service.service}:`, error.message);
          }
        }
      }
    } catch (error) {
      console.error('Error stopping services:', error);
    }
  }

  // Send final heartbeat if registered
  if (isRegistered) {
    sendHeartbeat().finally(() => {
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const resources = await resourceDetector.getAllResources();
    
    res.json({
      status: isRegistered ? 'online' : 'offline',
      hostname: WORKER_HOSTNAME || 'unknown',
      ip_address: WORKER_IP || 'unknown',
      conductor_url: CONDUCTOR_URL,
      registered: isRegistered,
      worker_id: conductorSocket.getWorkerId() || conductorService.getWorkerId(),
      websocket_connected: conductorSocket.getIsConnected(),
      docker_connected: dockerConnected,
      resources: {
        cpu_cores: resources.cpu_cores,
        ram_gb: resources.ram_gb,
        disk_gb: resources.disk_gb,
        network_mbps: resources.network_mbps
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Status endpoint
app.get('/status', async (req, res) => {
  try {
    const resources = await resourceDetector.getAllResources();
    let services = [];
    
    if (dockerConnected) {
      try {
        services = await ServiceManager.listServices();
      } catch (error) {
        console.error('Error listing services:', error);
      }
    }
    
    res.json({
      worker: {
        hostname: WORKER_HOSTNAME || 'unknown',
        ip_address: WORKER_IP || 'unknown',
        id: conductorService.getWorkerId(),
        registered: isRegistered,
        conductor_url: CONDUCTOR_URL,
        docker_connected: dockerConnected
      },
      resources: {
        cpu: resources.cpu,
        ram: resources.ram,
        disk: resources.disk,
        network: resources.network
      },
      services: services,
      intervals: {
        heartbeat: HEARTBEAT_INTERVAL / 1000,
        resource_check: RESOURCE_CHECK_INTERVAL / 1000,
        deployment_check: DEPLOYMENT_CHECK_INTERVAL / 1000,
        service_status: SERVICE_STATUS_INTERVAL / 1000
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Service management endpoints (for debugging)
app.get('/services', async (req, res) => {
  try {
    if (!dockerConnected) {
      return res.status(503).json({
        error: 'Docker daemon not connected',
        services: []
      });
    }

    const services = await ServiceManager.listServices();
    res.json({ services });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

app.get('/services/:name', async (req, res) => {
  try {
    if (!dockerConnected) {
      return res.status(503).json({
        error: 'Docker daemon not connected'
      });
    }

    const { name } = req.params;
    const status = await ServiceManager.getServiceStatus(name);
    res.json({ service: status });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

app.post('/services/:name/restart', async (req, res) => {
  try {
    if (!dockerConnected) {
      return res.status(503).json({
        error: 'Docker daemon not connected'
      });
    }

    const { name } = req.params;
    const result = await ServiceManager.restartService(name);
    res.json({ result });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

// Start server
app.listen(PORT, async () => {
  console.log(`Worker API server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Conductor URL: ${CONDUCTOR_URL}`);
  console.log(`Hostname and IP will be detected by conductor during registration`);

  // Check Docker connection
  await checkDockerConnection();

  // Register with conductor
  const registered = await registerWorker();
  
  if (registered) {
    // WebSocket heartbeat is started in registerWorker() and includes resources
    // Resource check loop is kept for HTTP fallback only (runs less frequently)
    startResourceCheckLoop(); // HTTP fallback, runs every 60s
    startDeploymentCheckLoop();
    startServiceStatusMonitoring();
  } else {
    console.error('Worker failed to register. Exiting...');
    process.exit(1);
  }
});

// Handle graceful shutdown
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  gracefulShutdown();
});


