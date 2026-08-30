require('dotenv').config();
const express = require('express');
const cors = require('cors');
const os = require('os');
const ConductorService = require('./api/services/ConductorService');
const ConductorSocketService = require('./api/services/ConductorSocketService');
const ResourceDetector = require('./utils/resourceDetector');
const ServiceManager = require('./docker/ServiceManager');
const DeploymentHandler = require('./services/DeploymentHandler');
const OrphanCleanupHandler = require('./services/OrphanCleanupHandler');
const { getStoredWorkerId, storeWorkerId, clearWorkerId } = require('./utils/workerIdStorage');
const { startLogShipping } = require('./utils/startLogShipping');

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
let WORKER_PROJECTS = []; // Store assigned projects

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

// Set up deployment instruction handler
conductorSocket.setOnDeploymentInstruction((instruction) => {
  console.log(`Received deployment instruction via WebSocket: ${instruction.action} for ${instruction.service}${instruction.project_id ? ` (project: ${instruction.project_id})` : ''}`);
  deploymentHandler.queueDeployment(instruction);
});

// Set up orphan cleanup handler
conductorSocket.setOnOrphanCleanup((cleanupData) => {
  console.log(`Received orphan cleanup instruction via WebSocket for ${cleanupData.orphanedDeploymentIds?.length || 0} deployments`);
  OrphanCleanupHandler.handleOrphanCleanup(cleanupData).then((result) => {
    console.log(`[OrphanCleanup] Cleanup result: ${result.cleaned} containers cleaned`);
  }).catch((error) => {
    console.error(`[OrphanCleanup] Cleanup error:`, error);
  });
});

// Sync workerId between ConductorSocketService and ConductorService
conductorSocket.setOnWorkerIdSet((workerId) => {
  conductorService.setWorkerId(workerId);
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
let logSpoolHandle = null;

// Middleware
app.use(cors());
app.use(express.json());

const { setupPrometheus } = require('./shared/simplePrometheusMetrics');
setupPrometheus(app, { serviceName: 'worker_agent' });

// USB Key Management routes
const usbRoutes = require('./api/routes/usb');
app.use('/api/usb', usbRoutes);

const containerRoutes = require('./api/routes/containers');
app.use('/api/containers', containerRoutes);

/**
 * Get actual device hostname and IP
 * Uses environment variables set by entrypoint script (preferred)
 * Falls back to detection if not set
 * @returns {Promise<{hostname: string, ip: string}>} Device hostname and IP
 */
async function enrichResources(resources) {
  return {
    ...resources,
    agent_port: parseInt(process.env.WORKER_AGENT_PORT || String(PORT), 10),
  };
}

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
      const resources = await enrichResources(await resourceDetector.getAllResources());
      lastResources = resources;

      // Get actual device hostname and IP (not Docker internal)
      const deviceInfo = await getDeviceInfo();
      
      // Try to register with existing worker ID
        worker = await conductorSocket.registerWorker(
          CONDUCTOR_TOKEN,
          deviceInfo.hostname,
          deviceInfo.ip,
          resources,
          storedWorkerId,
          [] // projectIds - will be assigned by conductor based on stored worker
        );
        
        // Store projects from registration response
        if (worker.projects) {
          WORKER_PROJECTS = worker.projects;
        }
        
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
      const resources = await enrichResources(await resourceDetector.getAllResources());
      lastResources = resources;

      // Get actual device hostname and IP (not Docker internal)
      const deviceInfo = await getDeviceInfo();
      console.log(`Detected device info - Hostname: ${deviceInfo.hostname}, IP: ${deviceInfo.ip}`);

      // Register with conductor via WebSocket (send actual device info)
      worker = await conductorSocket.registerWorker(
        CONDUCTOR_TOKEN,
        deviceInfo.hostname,
        deviceInfo.ip,
        resources,
        null, // existingWorkerId
        [] // projectIds - will be assigned by conductor
      );
      
      // Store projects from registration response
      if (worker.projects) {
        WORKER_PROJECTS = worker.projects;
      }

      // Also register via HTTP for backward compatibility
      try {
        const httpWorker = await conductorService.registerWorker(
          CONDUCTOR_TOKEN,
          deviceInfo.hostname,
          deviceInfo.ip,
          resources,
          null, // existingWorkerId
          WORKER_PROJECTS.map(p => p.id || p) // projectIds
        );
        // Update projects from HTTP response if WebSocket didn't provide them
        if (!WORKER_PROJECTS.length && httpWorker.projects) {
          WORKER_PROJECTS = httpWorker.projects;
        }
      } catch (httpError) {
        // HTTP registration is optional if WebSocket works
        console.warn('HTTP registration failed (using WebSocket only):', httpError.message);
      }
    }

    // Store worker ID to file for persistence
    storeWorkerId(worker.id);

    // Sync worker ID to ConductorService (for HTTP API calls)
    conductorService.setWorkerId(worker.id);

    // Store IP and hostname returned by conductor (in memory only)
    WORKER_HOSTNAME = worker.hostname;
    WORKER_IP = worker.ip_address;
    
    // Store projects assigned to worker
    WORKER_PROJECTS = worker.projects || [];

    console.log(`✓ Worker ${isNewRegistration ? 'registered' : 'verified'} successfully via WebSocket!`);
    console.log(`  Worker ID: ${worker.id}`);
    console.log(`  Hostname: ${WORKER_HOSTNAME}`);
    console.log(`  IP Address: ${WORKER_IP}`);
    console.log(`  Status: ${worker.status}`);
    if (WORKER_PROJECTS.length > 0) {
      console.log(`  Projects: ${WORKER_PROJECTS.map(p => p.name || p.id).join(', ')}`);
    }

    isRegistered = true;
    registrationAttempts = 0;
    
    // Start WebSocket-based heartbeat
    startWebSocketHeartbeat();
    
    // Refresh projects from conductor and auto-deploy services per project
    try {
      const projects = await conductorService.getWorkerProjects();
      if (projects && projects.length > 0) {
        WORKER_PROJECTS = projects;
        console.log(`  Projects updated: ${WORKER_PROJECTS.map(p => p.name || p.id).join(', ')}`);
        deployProjectServices();
      }
    } catch (error) {
      console.warn('Failed to refresh projects:', error.message);
      // Continue anyway - projects will be refreshed on next heartbeat
    }
    
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
    const resources = await enrichResources(await resourceDetector.getAllResources());
    
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
      network: resources.network,
      processes: resources.processes,
      // Deployed code version (git short SHA) for outdated-device detection.
      version: resources.version
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
    const resources = await enrichResources(await resourceDetector.getAllResources());
    
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
 * Filters by worker's assigned projects
 */
async function checkDeploymentInstructions() {
  if (!isRegistered) {
    return;
  }

  try {
    // Get deployment instructions for each assigned project
    for (const project of WORKER_PROJECTS) {
      try {
        const instructions = await conductorService.getDeploymentInstructions(project.id);
        
        if (instructions && instructions.length > 0) {
          for (const instruction of instructions) {
            console.log(`Received deployment instruction: ${instruction.action} for ${instruction.service} (project: ${project.name || project.id})`);
            deploymentHandler.queueDeployment(instruction);
          }
        }
      } catch (error) {
        console.error(`✗ Failed to check deployment instructions for project ${project.id}:`, error.message);
      }
    }
    
    // Also check for non-project deployments (backward compatibility)
    try {
      const instructions = await conductorService.getDeploymentInstructions();
      
      if (instructions && instructions.length > 0) {
        for (const instruction of instructions) {
          // Only process if no project_id (backward compatibility)
          if (!instruction.project_id) {
            console.log(`Received deployment instruction: ${instruction.action} for ${instruction.service} (no project)`);
            deploymentHandler.queueDeployment(instruction);
          }
        }
      }
    } catch (error) {
      // Don't log errors for getDeploymentInstructions - it's expected to return empty array for now
      if (!error.message.includes('not implemented')) {
        console.error(`✗ Failed to check deployment instructions:`, error.message);
      }
    }
  } catch (error) {
    console.error(`✗ Failed to check deployment instructions:`, error.message);
  }
}

/**
 * Deploy services for each assigned project
 */
async function deployProjectServices() {
  if (!isRegistered || WORKER_PROJECTS.length === 0) {
    return;
  }

  console.log(`[AutoDeploy] Checking services for ${WORKER_PROJECTS.length} project(s)...`);

  for (const project of WORKER_PROJECTS) {
    try {
      console.log(`[AutoDeploy] Checking services for project: ${project.name || project.id}`);
      
      // Get deployed services for this project
      const services = await conductorService.getDeployedServices(project.id);
      
      if (services && services.length > 0) {
        console.log(`[AutoDeploy] Found ${services.length} service(s) for project ${project.name || project.id}`);
        
        for (const serviceConfig of services) {
          try {
            // Service config from conductor has 'name' field
            const serviceName = serviceConfig.name;
            if (!serviceName) {
              console.warn(`[AutoDeploy] Service config missing name field:`, serviceConfig);
              continue;
            }
            
            console.log(`[AutoDeploy] Deploying service: ${serviceName} for project: ${project.name || project.id}`);
            
            // Build config with docker_image and other settings
            const config = {
              docker_image: serviceConfig.docker_image,
              ...serviceConfig.config,
              project_name: project.name,
              project_id: project.id // Include project_id for container labels
            };
            
            await deploymentHandler.deployService(serviceName, config, project.name);
          } catch (error) {
            console.error(`[AutoDeploy] Failed to deploy service:`, error.message);
          }
        }
      }
    } catch (error) {
      console.error(`[AutoDeploy] Error checking services for project ${project.id}:`, error.message);
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
 * Also auto-starts services that should be running but aren't
 */
async function monitorServiceStatus() {
  if (!isRegistered) {
    return;
  }

  try {
    // Get services that should be running (from conductor)
    // ONLY get services for assigned projects - never auto-start non-project services
    let deployedServices = [];
    try {
      // Get deployed services for each assigned project only
      for (const project of WORKER_PROJECTS) {
        try {
          const projectServices = await conductorService.getDeployedServices(project.id);
          deployedServices.push(...projectServices);
        } catch (error) {
          console.warn(`Failed to get deployed services for project ${project.id}:`, error.message);
        }
      }
    } catch (error) {
      // If endpoint doesn't exist yet, skip auto-start (backward compatibility)
      if (error.message.includes('404') || error.message.includes('not found')) {
        console.log('Deployed services endpoint not available, skipping auto-start');
      } else {
        throw error;
      }
    }

    // Get services that are actually running (from Docker)
    // Filter to only include services that are actually running (not just existing)
    const runningServices = await ServiceManager.listServices();
    // Create a map of service name + project_id -> running status
    const runningServiceMap = new Map();
    runningServices
      .filter(s => s.running === true)
      .forEach(s => {
        // Use project_id from labels if available, otherwise try to match project name to project_id
        let projectId = s.project_id;
        if (!projectId && s.project) {
          // Try to find project_id from WORKER_PROJECTS by matching project name
          const project = WORKER_PROJECTS.find(p => p.name === s.project);
          projectId = project?.id || null;
        }
        const key = projectId ? `${s.service}:${projectId}` : s.service;
        runningServiceMap.set(key, true);
      });

    // Report status for running services
    for (const service of runningServices) {
      const status = service.running ? 'running' : 'stopped';
      await conductorService.reportServiceStatus(service.service, status);
    }

    // Auto-start services that should be running but aren't
    // ONLY auto-start project-specific services - skip services without project_id
    for (const deployedService of deployedServices) {
      const serviceName = deployedService.name;
      const projectId = deployedService.project_id || null;
      
      // SKIP services without project_id - they should not be auto-started by worker
      // Only project-specific services should be auto-started
      if (!projectId) {
        continue;
      }
      
      // Check if service is running (consider project_id for project-scoped services)
      const serviceKey = `${serviceName}:${projectId}`;
      const isRunning = runningServiceMap.has(serviceKey);
      
      if (!isRunning) {
        // Get project name if projectId provided (for container naming)
        let projectName = null;
        if (projectId) {
          // Try to get project name from WORKER_PROJECTS
          const project = WORKER_PROJECTS.find(p => p.id === projectId);
          projectName = project?.name || null;
        }
        
        // Check if container exists but is stopped or crashed (try restart first)
        const serviceStatus = await ServiceManager.getServiceStatus(serviceName, projectName);
        const containerExists = serviceStatus.status !== 'not_found';
        
        if (containerExists && !serviceStatus.running) {
          // Container exists but stopped/crashed - queue restart through DeploymentHandler
          // This ensures proper duplicate prevention and tracking
          const reason = serviceStatus.exitCode !== undefined && serviceStatus.exitCode !== 0
            ? 'crashed'
            : 'stopped';
          const exitInfo = serviceStatus.exitCode !== undefined 
            ? ` (exit code: ${serviceStatus.exitCode}${serviceStatus.error ? `, error: ${serviceStatus.error}` : ''})`
            : '';
          console.log(`⚠ Service ${serviceName}${projectId ? ` (project: ${projectId})` : ''} container exists but is ${reason}${exitInfo}. Queuing restart...`);
          try {
            deploymentHandler.queueDeployment({
              action: 'restart',
              service: serviceName,
              project_id: projectId
            });
            console.log(`✓ Queued restart for service ${serviceName}${projectId ? ` (project: ${projectId})` : ''}`);
            continue; // Move to next service
          } catch (error) {
            console.log(`⚠ Failed to queue restart for ${serviceName}, will try deploy: ${error.message}`);
            // Fall through to deploy new container
          }
        }
        
        // Container doesn't exist or restart failed - deploy new one
        console.log(`⚠ Service ${serviceName}${projectId ? ` (project: ${projectId})` : ''} should be running but isn't. Auto-starting...`);
        try {
          // Queue deployment instruction to start the service
          // Use a unique timestamp to allow retries if previous attempt failed
          deploymentHandler.queueDeployment({
            action: 'deploy',
            service: serviceName,
            project_id: projectId,
            config: {
              docker_image: deployedService.docker_image,
              ...deployedService.config,
              project_name: projectName // Include project_name for container naming
            },
            timestamp: Date.now() // Include timestamp for this specific attempt
          });
          console.log(`✓ Queued auto-start for service ${serviceName}${projectId ? ` (project: ${projectId})` : ''}`);
        } catch (error) {
          console.error(`✗ Failed to auto-start service ${serviceName}:`, error.message);
        }
      }
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

  if (logSpoolHandle) {
    try {
      logSpoolHandle.stop();
    } catch (e) {
      console.error('log spool stop:', e.message);
    }
    logSpoolHandle = null;
  }

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
    const resources = await enrichResources(await resourceDetector.getAllResources());
    
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
    const resources = await enrichResources(await resourceDetector.getAllResources());
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
    logSpoolHandle = startLogShipping();
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


