const axios = require('axios');
const WorkerRepository = require('../repos/WorkerRepository');
const { Service, ServiceDeployment, Project, ProjectService: ProjectServiceModel } = require('../models');
const WorkerSocketService = require('./WorkerSocketService');
const LoadBalancer = require('./LoadBalancer');
const ServiceOrchestrator = require('./ServiceOrchestrator');
const MANAGER_SERVICE_PORTS = require('../config/managerServicePorts');
const { mergeProjectSecretsIntoConfig } = require('./projectSecretEnv');

/**
 * Map a worker (device) to its friendly display name.
 * Single source of truth for device naming — used by ServiceManager status
 * endpoints and by InfraService (IaC export/apply) so files and UI agree.
 */
function friendlyDevice(worker) {
  if (!worker) return null;
  if (worker.display_name) return worker.display_name;
  const host = String(worker.hostname || '');
  if (host === 'aerekos-server' || host === 'prod') return 'Prod-Mini';
  if (host === 'aerekos-M5-PLUS') return 'Dev-Mini';
  if (host === 'ubuntu' || /orin/i.test(host)) return 'Orin';
  return host || null;
}

/**
 * Service Manager - Manages service deployments and proxying
 */
class ServiceManager {
  constructor(workerRepository) {
    this.workerRepository = workerRepository;
    // In-memory queue for pending deployment instructions (for HTTP polling fallback)
    this.pendingDeployments = new Map(); // Map<workerId, Array<instruction>>
    this._conductorToken = null; // Cache conductor token
  }

  _friendlyDevice(worker) {
    return friendlyDevice(worker);
  }

  /**
   * One placement row per service name (shared instance).
   */
  async listPlacements() {
    const { isPlatformDeviceService } = require('../config/platformDeviceServices');
    const services = await Service.findAll();
    const deployments = await ServiceDeployment.findAll();
    const workers = await this.workerRepository.findAll().catch(() => []);
    const workerById = new Map((workers || []).map((w) => [w.id, w]));
    const deployByService = new Map();
    for (const d of deployments || []) {
      const cur = deployByService.get(d.service_id);
      const live = d.status === 'deployed' || d.status === 'running';
      if (!cur || (live && cur.status !== 'deployed' && cur.status !== 'running')) {
        deployByService.set(d.service_id, d);
      }
    }
    const out = {};
    for (const s of services || []) {
      const d = deployByService.get(s.id);
      const worker = d?.worker_id ? workerById.get(d.worker_id) : null;
      const platform = isPlatformDeviceService(s.name);
      const device = this._friendlyDevice(worker)
        || (s.name === 'ai_manager' ? 'Orin' : (platform ? 'Prod-Mini' : null));
      out[s.name] = {
        worker_id: d?.worker_id || worker?.id || null,
        worker_hostname: worker?.hostname || null,
        device,
        shared: platform || Boolean(d),
        status: d?.status || (platform ? 'shared' : null),
      };
    }
    return out;
  }
  
  /**
   * Get conductor's service token (cached)
   */
  async getConductorServiceToken() {
    if (this._conductorToken) {
      return this._conductorToken;
    }
    
    let serviceToken = process.env.CONDUCTOR_TOKEN || process.env.SERVICE_TOKEN;
    
    if (!serviceToken) {
      const conductorService = await Service.findAll({ where: { name: 'conductor' } });
      if (conductorService.length > 0 && conductorService[0].service_token) {
        serviceToken = conductorService[0].service_token;
        this._conductorToken = serviceToken;
      } else {
        throw {
          status: 503,
          message: 'Conductor service token not available. Conductor must be registered as a service.',
          code: 'CONDUCTOR_NOT_REGISTERED'
        };
      }
    } else {
      this._conductorToken = serviceToken;
    }
    
    return serviceToken;
  }

  /**
   * Authorization for direct manager routing (gateway bootstrap, internal proxy).
   * Prefers auth_manager client_credentials for gated services.
   */
  async _proxyAuthorizationHeader(serviceName, options = {}) {
    if (options.headers?.Authorization) {
      return options.headers.Authorization;
    }
    const authManagerToken = require('../utils/authManagerToken');
    if (authManagerToken.isGated(serviceName)) {
      const token = await authManagerToken.getToken();
      if (token) return `Bearer ${token}`;
    }
    const serviceToken = await this.getConductorServiceToken();
    return serviceToken ? `Bearer ${serviceToken}` : null;
  }

  /**
   * Enable a service (deploy to worker)
   * @param {string} serviceName - Service name (e.g., 'key_manager')
   * @param {string} [workerId] - Optional worker ID (auto-select if not provided)
   * @param {string} [projectId] - Optional project ID (for project-specific deployment)
   * @returns {Promise<object>} Deployment result
   */
  async enableService(serviceName, workerId = null, projectId = null) {
    try {
      // Resolve service first — orchestrator and deployments need service.id
      let service = await Service.findAll({ where: { name: serviceName } });
      service = service.length > 0 ? service[0] : null;

      if (!service) {
        service = await Service.create({
          name: serviceName,
          enabled: 1,
          docker_image: `aerekos-${serviceName}:latest`,
          config: JSON.stringify({})
        });
      } else {
        await Service.update(service.id, { enabled: 1 });
      }

      // Per-project enablement — setup wizard and project dashboards read ProjectService.
      if (projectId) {
        const existing = await ProjectServiceModel.findAll({
          where: { project_id: projectId, service_id: service.id },
        });
        if (existing.length === 0) {
          await ProjectServiceModel.create({
            project_id: projectId,
            service_id: service.id,
            enabled: 1,
            config: '{}',
            scaling_policy: '{}',
          });
        } else if (existing[0].enabled !== 1) {
          await ProjectServiceModel.update(existing[0].id, { enabled: 1 });
        }
      }

      const { isPlatformDeviceService } = require('../config/platformDeviceServices');
      const existingDeploys = await ServiceDeployment.findAll({ where: { service_id: service.id } });
      const liveShared = existingDeploys.find((d) => d.status === 'deployed' || d.status === 'running');
      if (isPlatformDeviceService(serviceName) || liveShared) {
        return {
          success: true,
          attached: true,
          skipped_deploy: true,
          platform: isPlatformDeviceService(serviceName),
          service_id: service.id,
          service_name: serviceName,
          project_id: projectId,
          worker_id: liveShared?.worker_id || workerId || null,
          message: liveShared
            ? `${serviceName} already runs on a device — this project is attached.`
            : `${serviceName} is a shared platform service — attached, not redeployed.`,
        };
      }

      // Get service config and add default ports if not specified (one host port per manager)
      const serviceConfig = JSON.parse(service.config || '{}');
      if (!serviceConfig.ports && MANAGER_SERVICE_PORTS[serviceName]) {
        serviceConfig.ports = MANAGER_SERVICE_PORTS[serviceName];
      }
      
      // Add default environment variables for specific services
      if (!serviceConfig.environment) {
        serviceConfig.environment = [];
      }
      
      // Add MASTER_KEY for key_manager if not present
      if (serviceName === 'key_manager') {
        const hasMasterKey = serviceConfig.environment.some(env => env.startsWith('MASTER_KEY='));
        if (!hasMasterKey) {
          serviceConfig.environment.push(`MASTER_KEY=${process.env.MASTER_KEY || 'dev-master-key-change-in-production'}`);
        }
        // Add other required env vars for key_manager
        const requiredEnvVars = {
          'CONDUCTOR_URL': process.env.CONDUCTOR_URL || 'http://host.docker.internal:3000',
          'SERVICE_NAME': 'key_manager',
          'PORT': '3002',
          'NODE_ENV': process.env.NODE_ENV || 'development'
        };
        for (const [key, value] of Object.entries(requiredEnvVars)) {
          const hasEnvVar = serviceConfig.environment.some(env => env.startsWith(`${key}=`));
          if (!hasEnvVar) {
            serviceConfig.environment.push(`${key}=${value}`);
          }
        }
      }
      
      // Add required env vars for storage_manager
      if (serviceName === 'storage_manager') {
        const requiredEnvVars = {
          'CONDUCTOR_URL': process.env.CONDUCTOR_URL || 'http://host.docker.internal:3000',
          'SERVICE_NAME': 'storage_manager',
          'PORT': '3003',
          'NODE_ENV': process.env.NODE_ENV || 'development'
        };
        for (const [key, value] of Object.entries(requiredEnvVars)) {
          const hasEnvVar = serviceConfig.environment.some(env => env.startsWith(`${key}=`));
          if (!hasEnvVar) {
            serviceConfig.environment.push(`${key}=${value}`);
          }
        }
      }

      if (serviceName === 'tunnel_manager') {
        const requiredEnvVars = {
          CONDUCTOR_URL: process.env.CONDUCTOR_URL || 'http://host.docker.internal:3000',
          SERVICE_NAME: 'tunnel_manager',
          PORT: '3110',
          NODE_ENV: process.env.NODE_ENV || 'development'
        };
        for (const [key, value] of Object.entries(requiredEnvVars)) {
          const hasEnvVar = serviceConfig.environment.some((env) => env.startsWith(`${key}=`));
          if (!hasEnvVar) {
            serviceConfig.environment.push(`${key}=${value}`);
          }
        }
      }

      if (serviceName === 'domain_manager') {
        const requiredEnvVars = {
          CONDUCTOR_URL: process.env.CONDUCTOR_URL || 'http://host.docker.internal:3000',
          SERVICE_NAME: 'domain_manager',
          PORT: '3111',
          NODE_ENV: process.env.NODE_ENV || 'development'
        };
        for (const [key, value] of Object.entries(requiredEnvVars)) {
          const hasEnvVar = serviceConfig.environment.some((env) => env.startsWith(`${key}=`));
          if (!hasEnvVar) {
            serviceConfig.environment.push(`${key}=${value}`);
          }
        }
      }

      if (serviceName === 'secrets_manager') {
        const requiredEnvVars = {
          CONDUCTOR_URL: process.env.CONDUCTOR_URL || 'http://host.docker.internal:3000',
          SERVICE_NAME: 'secrets_manager',
          PORT: '3107',
          NODE_ENV: process.env.NODE_ENV || 'development'
        };
        for (const [key, value] of Object.entries(requiredEnvVars)) {
          const hasEnvVar = serviceConfig.environment.some((env) => env.startsWith(`${key}=`));
          if (!hasEnvVar) {
            serviceConfig.environment.push(`${key}=${value}`);
          }
        }
      }
      
      // For development, mount aerekos-record as volume for hot-reload
      // In production, it's baked into the image
      // Note: Volume mounts need to be from the host filesystem, not container paths
      // The worker container has ./services mounted at /app/services
      // So we need to mount from the host's services directory
      // For now, skip volume mount - aerekos-record is baked into the image
      // TODO: Add volume mount if needed for development hot-reload
      // if (process.env.NODE_ENV === 'development' && !serviceConfig.volumes) {
      //   serviceConfig.volumes = [
      //     '../services/aerekos-record:/app/services/aerekos-record:ro'
      //   ];
      // }
      
      // Get project name if projectId provided (for container naming)
      let projectName = null;
      if (projectId) {
        const projects = await Project.findAll({ where: { id: projectId } });
        if (projects.length > 0) {
          projectName = projects[0].name;
        }
      }

      if (projectId) {
        try {
          const token = await this.getConductorServiceToken();
          const { injected, skipped } = await mergeProjectSecretsIntoConfig({
            serviceName,
            projectId,
            serviceConfig,
            bearerToken: token
          });
          if (injected > 0) {
            console.log(
              `[ServiceManager] Injected ${injected} env var(s) from secrets_manager for ${serviceName}`
            );
          } else if (skipped && skipped !== 'no map or project') {
            console.warn(`[ServiceManager] Secret env injection: ${skipped}`);
          }
        } catch (e) {
          console.warn('[ServiceManager] Secret env injection skipped:', e.message);
        }
      }

      // Find available worker(s)
      let workers = [];
      if (workerId) {
        const worker = await this.workerRepository.findById(workerId);
        if (!worker) {
          throw new Error(`Worker ${workerId} not found`);
        }
        workers = [worker];
      } else if (projectId) {
        try {
          const selectedWorkerIds = await ServiceOrchestrator.findOptimalWorkers(projectId, service.id, {
            placementStrategy: 'binpack',
            minInstances: 1,
            maxInstances: 1,
            serviceName,
          });

          for (const selectedWorkerId of selectedWorkerIds) {
            const worker = await this.workerRepository.findById(selectedWorkerId);
            if (worker) {
              workers.push(worker);
            }
          }
        } catch (orchestratorError) {
          console.warn(`[ServiceManager] ServiceOrchestrator failed, using fallback:`, orchestratorError.message);
          const allWorkers = await this.workerRepository.findAll({ where: { status: 'online' } });
          if (allWorkers.length > 0) {
            workers = [allWorkers[0]];
          }
        }
      } else {
        const allWorkers = await this.workerRepository.findAll({ where: { status: 'online' } });
        if (allWorkers.length === 0) {
          throw new Error('No online workers available');
        }
        workers = [allWorkers[0]];
      }

      if (workers.length === 0) {
        throw new Error('No workers available for deployment');
      }

      const deploymentResults = [];
      for (const worker of workers) {
        // Send deployment instruction to worker via WebSocket or HTTP
        const deploymentResult = await this.sendDeploymentInstruction(worker, {
          action: 'deploy',
          service: serviceName,
          project_id: projectId,
          project_name: projectName,
          config: {
            docker_image: service.docker_image,
            ...serviceConfig
          }
        });

        // Create or update service deployment record
        const deploymentWhere = { service_id: service.id, worker_id: worker.id };
        if (projectId) {
          deploymentWhere.project_id = projectId;
        } else {
          // For backward compatibility, also check for NULL project_id
          deploymentWhere.project_id = null;
        }
        
        const existingDeployment = await ServiceDeployment.findAll({
          where: deploymentWhere
        });

        if (existingDeployment.length > 0) {
          await ServiceDeployment.update(existingDeployment[0].id, {
            status: 'deployed',
            deployed_at: new Date().toISOString(),
            project_id: projectId || null,
            orphaned: 0
          });
        } else {
          await ServiceDeployment.create({
            service_id: service.id,
            worker_id: worker.id,
            project_id: projectId || null,
            status: 'deployed',
            deployed_at: new Date().toISOString(),
            orphaned: 0
          });
        }

        deploymentResults.push({
          workerId: worker.id,
          workerHostname: worker.hostname,
          ...deploymentResult
        });
      }

      // Configure load balancer for this service if projectId provided
      if (projectId) {
        try {
          await LoadBalancer.configureLoadBalancer(projectId, service.id, {
            algorithm: 'round-robin',
            healthCheckInterval: 30000,
            maxFailures: 3
          });
        } catch (lbError) {
          console.warn(`[ServiceManager] Failed to configure load balancer:`, lbError.message);
        }
      }

      if (projectId && ['compute_manager', 'db_manager'].includes(serviceName)) {
        try {
          await this.proxyServiceRequest(
            'network_manager',
            'POST',
            '/api/v1/networks/ensure-default',
            { project_id: projectId },
            {},
            projectId
          );
        } catch (netErr) {
          console.warn('[ServiceManager] default VPC attach skipped:', netErr.message);
        }
      }

      return {
        success: true,
        service_id: service.id,
        service_name: serviceName,
        deployments: deploymentResults,
        project_id: projectId
      };
    } catch (error) {
      console.error(`[ServiceManager] Error enabling service ${serviceName}:`, error);
      throw error;
    }
  }

  /**
   * Disable a service (stop and remove from worker)
   * @param {string} serviceName - Service name
   * @param {string} [projectId] - Optional project ID (filter by project)
   * @returns {Promise<object>} Shutdown result
   */
  async disableService(serviceName, projectId = null) {
    try {
      const { isPlatformDeviceService } = require('../config/platformDeviceServices');
      if (isPlatformDeviceService(serviceName)) {
        return { disabled: false, platform: true, message: `${serviceName} is always-on per device` };
      }
      const services = await Service.findAll({ where: { name: serviceName } });
      if (services.length === 0) {
        throw new Error(`Service ${serviceName} not found`);
      }

      const service = services[0];

      if (projectId) {
        const rows = await ProjectServiceModel.findAll({
          where: { project_id: projectId, service_id: service.id },
        });
        for (const row of rows) {
          await ProjectServiceModel.update(row.id, { enabled: 0 });
        }
        return {
          success: true,
          detached: true,
          service_id: service.id,
          service_name: serviceName,
          project_id: projectId,
          message: `${serviceName} detached from this project. Shared instance left running.`,
        };
      }

      // Find deployments (filter by project if provided)
      const deploymentWhere = { service_id: service.id };
      if (projectId) {
        deploymentWhere.project_id = projectId;
      }
      
      const deployments = await ServiceDeployment.findAll({
        where: deploymentWhere
      });

      // Get project name if projectId provided (for container naming)
      let projectName = null;
      if (projectId) {
        const projects = await Project.findAll({ where: { id: projectId } });
        if (projects.length > 0) {
          projectName = projects[0].name;
        }
      }

      // Stop service on all workers
      for (const deployment of deployments) {
        const worker = await this.workerRepository.findById(deployment.worker_id);
        if (worker) {
          try {
            await this.sendDeploymentInstruction(worker, {
              action: 'stop',
              service: serviceName,
              project_id: projectId,
              project_name: projectName
            });
          } catch (error) {
            console.error(`[ServiceManager] Error stopping service on worker ${worker.id}:`, error);
          }
        }
      }

      // Update service to disabled
      await Service.update(service.id, { enabled: 0 });

      // Update deployment status
      for (const deployment of deployments) {
        await ServiceDeployment.update(deployment.id, { status: 'stopped' });
      }

      return {
        success: true,
        service_id: service.id,
        stopped_deployments: deployments.length
      };
    } catch (error) {
      console.error(`[ServiceManager] Error disabling service ${serviceName}:`, error);
      throw error;
    }
  }

  /**
   * Get service status
   * @param {string} serviceName - Service name
   * @param {string} [projectId] - Optional project ID (filter by project)
   * @returns {Promise<object>} Service status
   */
  async getServiceStatus(serviceName, projectId = null) {
    try {
      const services = await Service.findAll({ where: { name: serviceName } });
      const service = services.length > 0 ? services[0] : null;

      if (!service) {
        return {
          enabled: false,
          deployed: false
        };
      }

      const deploymentWhere = { service_id: service.id, status: 'deployed' };
      if (projectId) {
        deploymentWhere.project_id = projectId;
      }
      
      const deployments = await ServiceDeployment.findAll({
        where: deploymentWhere
      });

      let health = null;
      if (deployments.length > 0) {
        // Try to get health from one of the deployed instances
        const deployment = deployments[0];
        const worker = await this.workerRepository.findById(deployment.worker_id);
        if (worker) {
          try {
            // Try to get health from service (via conductor proxy)
            // This will be handled by the proxy route
            health = { status: 'unknown' };
          } catch (error) {
            // Health check failed
            health = { status: 'unreachable', error: error.message };
          }
        }
      }

      const { isPlatformDeviceService } = require('../config/platformDeviceServices');
      const platform = isPlatformDeviceService(serviceName);
      const workerId = deployments.length > 0 ? deployments[0].worker_id : null;
      let worker = null;
      if (workerId) {
        worker = await this.workerRepository.findById(workerId).catch(() => null);
      }
      return {
        enabled: platform || service.enabled === 1,
        deployed: platform || deployments.length > 0,
        platform,
        shared: platform || deployments.length > 0,
        worker_id: workerId,
        worker_hostname: worker?.hostname || null,
        device: this._friendlyDevice(worker) || (serviceName === 'ai_manager' ? 'Orin' : (platform ? 'Prod-Mini' : null)),
        health: health
      };
    } catch (error) {
      console.error(`[ServiceManager] Error getting service status for ${serviceName}:`, error);
      throw error;
    }
  }

  /**
   * Get all instances of a service
   * @param {string} serviceName - Service name
   * @param {string} [projectId] - Optional project ID (filter by project)
   * @returns {Promise<Array>} Service instances
   */
  async getServiceInstances(serviceName, projectId = null) {
    try {
      const services = await Service.findAll({ where: { name: serviceName } });
      if (services.length === 0) {
        return [];
      }

      const service = services[0];
      const deploymentWhere = { service_id: service.id };
      if (projectId) {
        deploymentWhere.project_id = projectId;
      }
      
      const deployments = await ServiceDeployment.findAll({
        where: deploymentWhere
      });

      const instances = [];
      for (const deployment of deployments) {
        const worker = await this.workerRepository.findById(deployment.worker_id);
        if (worker) {
          let resources = {};
          try {
            resources = worker.resources ? JSON.parse(worker.resources) : {};
          } catch (_) { /* ignore */ }
          instances.push({
            worker_id: worker.id,
            worker_hostname: worker.hostname,
            worker_ip: worker.ip_address || null,
            worker_status: worker.status,
            worker_version: resources.version || null,
            worker_resources: {
              cpu_cores: resources.cpu_cores,
              ram_gb: resources.ram_gb,
              gpu: resources.gpu,
            },
            project_id: deployment.project_id,
            deployment_id: deployment.id,
            status: deployment.status,
            deployed_at: deployment.deployed_at,
          });
        }
      }

      return instances;
    } catch (error) {
      console.error(`[ServiceManager] Error getting service instances for ${serviceName}:`, error);
      throw error;
    }
  }

  /**
   * Proxy request to service (with load balancing)
   * @param {string} serviceName - Service name
   * @param {string} method - HTTP method
   * @param {string} path - Request path
   * @param {object} [data] - Request data
   * @param {object} [query] - Query parameters
   * @param {string} [projectId] - Optional project ID (filter by project)
   * @param {object} [options] - Additional options
   * @param {string} [options.clientIp] - Client IP address (for IP-hash load balancing)
   * @returns {Promise<object>} Service response
   */
  /**
   * Proxy service request without requiring projectId (for health checks)
   * Finds any available deployment for the service
   */
  async proxyServiceRequestWithoutProject(serviceName, method, path, data = null, query = {}, options = {}) {
    try {
      const services = await Service.findAll({ where: { name: serviceName } });
      if (services.length === 0) {
        throw {
          status: 404,
          message: `Service ${serviceName} not found`,
          code: 'SERVICE_NOT_FOUND'
        };
      }
      
      const service = services[0];
      const { ServiceDeployment } = require('../models');
      
      // Find any deployment for this service
      const deployments = await ServiceDeployment.findAll({
        where: { service_id: service.id }
      });
      
      if (deployments.length === 0) {
        // Single-host compose stack: service self-registered but isn't deployed by
        // a worker. Fall back to direct routing over the Docker network.
        const direct = await this._directServiceRequest(
          serviceName,
          method,
          path,
          data,
          query,
          options
        );
        if (direct) {
          return direct;
        }
        throw {
          status: 503,
          message: `No deployments found for service ${serviceName}`,
          code: 'NO_DEPLOYMENTS'
        };
      }
      
      // Use the first deployment's projectId (or null if no project)
      const deployment = deployments[0];
      const projectId = deployment.project_id || null;
      
      // Use the regular proxy method with the found projectId
      return await this.proxyServiceRequest(serviceName, method, path, data, query, projectId, options);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Direct routing fallback used when a service is registered but has no
   * worker-managed ServiceDeployment (e.g. the single-host docker-compose stack
   * where each manager runs as its own container and self-registers).
   *
   * Reaches the service over the Docker network via its service-name / container
   * alias. Disabled by setting CONDUCTOR_DIRECT_SERVICE_ROUTING=false.
   *
   * @returns {Promise<{status,data,headers}|null>} response, or null if every
   *          candidate URL was unreachable (so the caller can fall back to 503).
   */
  async _directServiceRequest(serviceName, method, path, data, query, options = {}) {
    if (process.env.CONDUCTOR_DIRECT_SERVICE_ROUTING === 'false') {
      return null;
    }
    const servicePort = this.getServicePort(serviceName);
    if (!servicePort) {
      return null;
    }
    const candidateUrls = [];
    // Operator-configured direct hosts (device .env SERVICE_DIRECT_HOSTS JSON).
    // Never bake hosts into this file.
    try {
      const map = JSON.parse(process.env.SERVICE_DIRECT_HOSTS || '{}');
      if (map[serviceName]) candidateUrls.push(String(map[serviceName]).replace(/\/$/, ''));
    } catch (_) { /* ignore malformed map */ }
    candidateUrls.push(
      `http://${serviceName}:${servicePort}`,
      `http://aerekos-${serviceName}:${servicePort}`,
      `http://host.docker.internal:${servicePort}`
    );

    const probeTimeout = options.timeout ?? (options.stream ? 30000 : 2000);

    let lastError = null;
    for (const baseUrl of candidateUrls) {
      try {
        const config = {
          method: method.toLowerCase(),
          url: `${baseUrl}${path}`,
          params: query,
          timeout: probeTimeout,
          validateStatus: () => true,
          headers: {},
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        };

        const authHeader = await this._proxyAuthorizationHeader(serviceName, options);
        if (authHeader) {
          config.headers['Authorization'] = authHeader;
        }
        if (options.headers) {
          Object.keys(options.headers).forEach((key) => {
            if (key !== 'Authorization' || !options.headers['Authorization']) {
              config.headers[key] = options.headers[key];
            }
          });
        }
        if (options.responseType) {
          config.responseType = options.responseType;
        }
        if (options.stream && (method === 'PUT' || method === 'POST' || method === 'PATCH')) {
          config.data = options.stream;
          if (options.stream.headers) {
            if (options.stream.headers['content-type']) {
              config.headers['Content-Type'] = options.stream.headers['content-type'];
            }
            if (options.stream.headers['content-length']) {
              config.headers['Content-Length'] = options.stream.headers['content-length'];
            }
          }
        } else if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
          config.data = data;
          config.headers['Content-Type'] = 'application/json';
        }

        const response = await axios(config);
        return {
          status: response.status,
          data: response.data,
          headers: response.headers
        };
      } catch (error) {
        lastError = error;
        // Try the next candidate URL on connection errors.
      }
    }
    if (lastError) {
      console.warn(
        `[ServiceManager] direct routing for ${serviceName} failed on all candidates: ${lastError.message}`
      );
    }
    return null;
  }

  async proxyServiceRequest(serviceName, method, path, data = null, query = {}, projectId = null, options = {}) {
    try {
      // Find service deployments
      const services = await Service.findAll({ where: { name: serviceName } });
      if (services.length === 0) {
        throw new Error(`Service ${serviceName} not found`);
      }

      const service = services[0];
      
      // Require projectId for all services (including key_manager - all services are project-scoped)
      // EXCEPTION: Signed URLs can work without projectId as they validate via HMAC signature
      // and can look up projectId from bucketId internally
      // EXCEPTION: /systems/ paths (system buckets) are project-less by design
      // EXCEPTION: key_manager /api/keys* is a GLOBAL key store (bucket encryption keys) —
      // projectless by design; storage_manager calls it for system buckets
      const isSignedUrl = path && path.includes('/signed/');
      const isSystemPath = path && path.includes('/systems/');
      const isGlobalKeyStore = serviceName === 'key_manager' && path && path.startsWith('/api/keys');
      if (!projectId && !isSignedUrl && !isSystemPath && !isGlobalKeyStore) {
        throw {
          status: 400,
          message: 'projectId is required for service proxying. All services are project-scoped.',
          code: 'PROJECT_ID_REQUIRED'
        };
      }
      
      // For signed URLs, system-bucket paths, and global key-store paths without projectId,
      // try to find any deployment
      // The storage_manager validates via signature (signed) or system scope (system buckets)
      if (!projectId && (isSignedUrl || isSystemPath || isGlobalKeyStore)) {
        // Find any deployment for this service (signed URLs are validated by signature)
        const anyDeployment = await ServiceDeployment.findAll({
          where: {
            service_id: service.id,
            status: 'deployed'
          },
          limit: 1
        });
        
        if (anyDeployment.length > 0) {
          projectId = anyDeployment[0].project_id; // Use this projectId for routing
        }
      }

      // Single-host compose: managers self-register as deployments but are reachable
      // on the Docker network (ai_manager:3126). Worker LAN IPs are often unreachable
      // from inside the conductor container — try direct routing first.
      if (process.env.CONDUCTOR_DIRECT_SERVICE_ROUTING !== 'false') {
        const directHit = await this._directServiceRequest(
          serviceName,
          method,
          path,
          data,
          query,
          options
        );
        if (directHit) {
          return directHit;
        }
      }

      // Refresh instance health before selecting (ensures new deployments are included)
      await LoadBalancer.refreshInstanceHealth(projectId, service.id);
      
      // Use LoadBalancer to select instance
      const deployment = await LoadBalancer.selectInstance(projectId, service.id, {
        clientIp: options.clientIp
      });

      if (!deployment) {
        // No worker-managed deployment. In a single-host docker-compose stack the
        // managers run as their own containers and only self-register, so fall back
        // to direct routing over the Docker network before giving up.
        const direct = await this._directServiceRequest(
          serviceName,
          method,
          path,
          data,
          query,
          options
        );
        if (direct) {
          return direct;
        }

        // Check if service is enabled for this project
        const { ProjectService: ProjectServiceModel } = require('../models');
        const projectServices = await ProjectServiceModel.findAll({
          where: { project_id: projectId, service_id: service.id }
        });
        
        const isEnabled = projectServices.length > 0 && projectServices[0].enabled === 1;
        
        // Check if there are any deployments (even unhealthy ones)
        const { ServiceDeployment } = require('../models');
        const allDeployments = await ServiceDeployment.findAll({
          where: { project_id: projectId, service_id: service.id }
        });
        
        let errorMessage;
        if (!isEnabled) {
          errorMessage = `Service ${serviceName} is not enabled for this project. Please enable it first.`;
        } else if (allDeployments.length === 0) {
          errorMessage = `Service ${serviceName} is enabled but not deployed yet. Deployment may be in progress or failed.`;
        } else {
          const deployedCount = allDeployments.filter(d => d.status === 'deployed').length;
          errorMessage = `No healthy instances available for service ${serviceName} in project ${projectId}. ${deployedCount} deployment(s) exist but may be unhealthy or containers not running.`;
        }
        
        throw {
          status: 503,
          message: errorMessage,
          code: 'NO_HEALTHY_INSTANCES',
          details: {
            service_enabled: isEnabled,
            total_deployments: allDeployments.length,
            deployed_count: allDeployments.filter(d => d.status === 'deployed').length
          }
        };
      }
      const worker = await this.workerRepository.findById(deployment.worker_id);
      if (!worker) {
        throw {
          status: 503,
          message: `Worker ${deployment.worker_id} not found`,
          code: 'WORKER_NOT_FOUND'
        };
      }

      // Get project name if projectId provided (for container naming)
      let projectName = null;
      if (projectId || deployment.project_id) {
        const actualProjectId = projectId || deployment.project_id;
        const projects = await Project.findAll({ where: { id: actualProjectId } });
        if (projects.length > 0) {
          projectName = projects[0].name;
        }
      }

      // Try multiple approaches to reach the service:
      // 1. Try via worker IP + port (services are exposed on host via port mapping)
      // 2. Try via Docker network name (if on same network)
      // 3. Try via localhost (if running locally)
      
      const servicePort = this.getServicePort(serviceName);
      // Use project-prefixed container name if project provided
      // For system services (no project), use simple service name
      const containerName = projectName 
        ? `aerekos-${projectName}-${serviceName}`
        : `aerekos-${serviceName}`;
      // Services are exposed on the worker host via port mapping (e.g., 0.0.0.0:3002->3002/tcp)
      // So we need to reach them via the worker's host IP address
      // Priority order:
      // 1. Worker host IP + port (PRIMARY - works for remote workers on different devices)
      // 2. Container network name (if conductor is on same Docker network as worker)
      // 3. localhost (only works if conductor and worker are on same machine)
      // 4. host.docker.internal (Docker Desktop specific)
      const serviceUrls = [];
      
      // PRIMARY: Worker host IP + port (services exposed on host via port mapping)
      // This is the correct approach for workers on different devices
      // Always try worker IP first - it will work for:
      // - Remote workers on different devices (using actual host IP)
      // - Workers on same Docker network (using Docker network IP)
      // Fallback chain below handles cases where IP doesn't work
      if (worker.ip_address) {
        serviceUrls.push(`http://${worker.ip_address}:${servicePort}`);
      }
      try {
        const { workerReachUrls } = require('../utils/networkIslands');
        for (const u of workerReachUrls(worker, servicePort)) {
          if (!serviceUrls.includes(u)) serviceUrls.push(u);
        }
      } catch (_) { /* overlay fallback is optional */ }
      
      // SECONDARY: Container network name (if on same Docker network)
      serviceUrls.push(`http://${containerName}:${servicePort}`);
      
      // TERTIARY: localhost (only if conductor and worker are on same machine)
      serviceUrls.push(`http://localhost:${servicePort}`);
      
      // FALLBACK: Docker Desktop host access
      serviceUrls.push(`http://host.docker.internal:${servicePort}`);
      
      // LAST RESORT: Service name
      serviceUrls.push(`http://${serviceName}:${servicePort}`);

      let lastError = null;
      
      for (const serviceUrl of serviceUrls) {
        try {
          const config = {
            method: method.toLowerCase(),
            url: `${serviceUrl}${path}`,
            params: query,
            timeout: options.timeout ?? 30000,
            validateStatus: () => true, // Don't throw on any status
            headers: {},
            maxContentLength: Infinity,
            maxBodyLength: Infinity
          };

          // Add service token for service-to-service authentication
          // Conductor needs to use its own registered service token
          // But if custom headers are provided (e.g., user JWT token), use those instead
          if (options.headers && options.headers['Authorization']) {
            config.headers['Authorization'] = options.headers['Authorization'];
          } else {
            const serviceToken = await this.getConductorServiceToken();
            config.headers['Authorization'] = `Bearer ${serviceToken}`;
          }
          
          // Merge any other custom headers
          if (options.headers) {
            Object.keys(options.headers).forEach(key => {
              if (key !== 'Authorization' || !options.headers['Authorization']) {
                config.headers[key] = options.headers[key];
              }
            });
          }

          // Handle response type based on options or request type
          if (options.responseType) {
            config.responseType = options.responseType; // Allow caller to specify responseType (e.g., 'arraybuffer' for file downloads)
          } else if (options.stream && (method === 'PUT' || method === 'POST' || method === 'PATCH')) {
            // For streaming uploads, pipe the request stream directly
            config.data = options.stream;
            config.responseType = 'json'; // Response is JSON, but request is stream
            
            // Copy Content-Type and Content-Length from original request if available
            if (options.stream.headers) {
              if (options.stream.headers['content-type']) {
                config.headers['Content-Type'] = options.stream.headers['content-type'];
              }
              if (options.stream.headers['content-length']) {
                config.headers['Content-Length'] = options.stream.headers['content-length'];
              }
            }
          } else if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            config.data = data;
            config.headers['Content-Type'] = 'application/json';
          }

          const response = await axios(config);
          
          // Mark instance as healthy on successful response
          LoadBalancer.updateInstanceHealth(deployment.id, response.status < 500);
          
          // Decrement connection count when request completes
          LoadBalancer.decrementConnections(deployment.id);
          
          // If we got a response (even error status), return it
          return {
            status: response.status,
            data: response.data,
            headers: response.headers
          };
        } catch (error) {
          lastError = error;
          
          // Mark instance as unhealthy on connection errors
          const isConnectionError = error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND';
          if (isConnectionError) {
            LoadBalancer.updateInstanceHealth(deployment.id, false);
            LoadBalancer.decrementConnections(deployment.id);
            
            // Try next instance if available (retry with load balancer)
            const retryDeployment = await LoadBalancer.selectInstance(projectId, service.id, {
              clientIp: options.clientIp
            });
            
            if (retryDeployment && retryDeployment.id !== deployment.id) {
              // Retry with different instance
              const retryWorker = await this.workerRepository.findById(retryDeployment.worker_id);
              if (retryWorker) {
                const retryProjectName = projectName;
                const retryServicePort = this.getServicePort(serviceName);
                const retryContainerName = retryProjectName 
                  ? `aerekos-${retryProjectName}-${serviceName}`
                  : `aerekos-${serviceName}`;
                const retryServiceUrls = [
                  `http://${retryWorker.ip_address}:${retryServicePort}`,
                  `http://${retryContainerName}:${retryServicePort}`,
                  `http://localhost:${retryServicePort}`,
                  `http://${serviceName}:${retryServicePort}`
                ];
                
                // Try retry URLs
                for (const retryUrl of retryServiceUrls) {
                  try {
                    const retryConfig = {
                      method: method.toLowerCase(),
                      url: `${retryUrl}${path}`,
                      params: query,
                      timeout: 5000,
                      validateStatus: () => true,
                      headers: {
                        'Authorization': `Bearer ${await this.getConductorServiceToken()}`
                      }
                    };
                    
                    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
                      retryConfig.data = data;
                      retryConfig.headers['Content-Type'] = 'application/json';
                    }
                    
                    const retryResponse = await axios(retryConfig);
                    LoadBalancer.updateInstanceHealth(retryDeployment.id, retryResponse.status < 500);
                    LoadBalancer.decrementConnections(retryDeployment.id);
                    
                    return {
                      status: retryResponse.status,
                      data: retryResponse.data,
                      headers: retryResponse.headers
                    };
                  } catch (retryError) {
                    if (retryError.code === 'ECONNREFUSED' || retryError.code === 'ETIMEDOUT' || retryError.code === 'ENOTFOUND') {
                      LoadBalancer.updateInstanceHealth(retryDeployment.id, false);
                      continue;
                    }
                  }
                }
              }
            }
            
            // Continue to next URL if connection refused, timeout, or hostname not found
            continue;
          }
          
          // Decrement connection count even on non-connection errors
          LoadBalancer.decrementConnections(deployment.id);
          
          // For other errors, throw immediately
          throw error;
        }
      }

      // All URLs failed
      LoadBalancer.decrementConnections(deployment.id);
      throw {
        status: 503,
        message: `Service ${serviceName} is not reachable. It may not be running or not accessible.`,
        code: 'SERVICE_UNREACHABLE',
        originalError: lastError?.message
      };
    } catch (error) {
      console.error(`[ServiceManager] Error proxying request to ${serviceName}:`, error.message || error);
      
      // If it's already a formatted error, re-throw it
      if (error.status && error.code) {
        throw error;
      }
      
      // Format axios errors
      if (error.response) {
        throw {
          status: error.response.status,
          message: error.response.data?.error?.message || error.message,
          data: error.response.data
        };
      }
      
      // Format connection errors
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        throw {
          status: 503,
          message: `Service ${serviceName} is not reachable. Please ensure the service is running.`,
          code: 'SERVICE_UNREACHABLE'
        };
      }
      
      throw error;
    }
  }

  /**
   * Get default port for service
   * @param {string} serviceName - Service name
   * @returns {number} Default port
   */
  getServicePort(serviceName) {
    const MANAGER_SERVICE_PORTS = require('../config/managerServicePorts');
    const map = MANAGER_SERVICE_PORTS[serviceName];
    if (map && typeof map === 'object') {
      const hostPort = Object.keys(map)[0];
      if (hostPort) {
        return parseInt(hostPort, 10);
      }
    }
    return 3000;
  }

  /**
   * Send deployment instruction to worker
   * @param {object} worker - Worker object
   * @param {object} instruction - Deployment instruction
   * @returns {Promise<object>} Deployment result
   */
  async sendDeploymentInstruction(worker, instruction) {
    // Try WebSocket first (preferred method)
    const sentViaWebSocket = WorkerSocketService.sendDeploymentInstruction(worker.id, instruction);
    
    if (sentViaWebSocket) {
      console.log(`[ServiceManager] Sent deployment instruction via WebSocket to worker ${worker.id}`);
      return {
        success: true,
        method: 'websocket',
        message: 'Deployment instruction sent via WebSocket'
      };
    }

    // WebSocket not available, queue for HTTP polling
    console.log(`[ServiceManager] Worker ${worker.id} not connected via WebSocket, queuing for HTTP polling`);
    
    if (!this.pendingDeployments.has(worker.id)) {
      this.pendingDeployments.set(worker.id, []);
    }
    
    this.pendingDeployments.get(worker.id).push({
      ...instruction,
      timestamp: new Date().toISOString()
    });

    return {
      success: true,
      method: 'queued',
      message: 'Deployment instruction queued for HTTP polling'
    };
  }

  /**
   * Get pending deployment instructions for a worker (for HTTP polling)
   * @param {string} workerId - Worker ID
   * @returns {Array} Pending deployment instructions
   */
  getPendingDeployments(workerId) {
    const pending = this.pendingDeployments.get(workerId) || [];
    // Clear after returning (instructions are consumed)
    this.pendingDeployments.delete(workerId);
    return pending;
  }
}

// Export singleton instance for shared state (pending deployments)
let sharedInstance = null;

/**
 * Get or create shared ServiceManager instance
 * @param {WorkerRepository} workerRepository - Worker repository instance
 * @returns {ServiceManager} ServiceManager instance
 */
ServiceManager.getInstance = function(workerRepository) {
  if (!sharedInstance) {
    sharedInstance = new ServiceManager(workerRepository);
  }
  return sharedInstance;
};

module.exports = ServiceManager;
module.exports.friendlyDevice = friendlyDevice;
