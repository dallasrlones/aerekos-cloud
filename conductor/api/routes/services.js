const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const authenticateService = require('../middleware/serviceAuth');
const appProxyAuth = require('../middleware/appProxyAuth');
const { requireIamAccess } = require('../middleware/requireIamAccess');
const { authorizationForProxy } = require('../utils/proxyAuthorization');
const { buildServiceProxyPath } = require('../utils/buildServiceProxyPath');
const ServiceManager = require('../services/ServiceManager');
const WorkerRepository = require('../repos/WorkerRepository');
const ProjectService = require('../services/ProjectService');
const SetupService = require('../services/SetupService');
const { Service } = require('../models');
const { randomUUID } = require('crypto');

// Initialize ServiceManager (use singleton for shared state)
// WorkerRepository is exported as an instance, not a class
const serviceManager = ServiceManager.getInstance(WorkerRepository);

/**
 * POST /api/services/validate-token
 * Validate a service token (called by services to validate other service tokens)
 * No authentication required - this is the validation endpoint itself
 */
router.post('/validate-token', async (req, res, next) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        error: {
          message: 'Token is required',
          status: 400
        }
      });
    }
    
    // Find service by token
    const services = await Service.findAll({ 
      where: { service_token: token } 
    });
    
    if (services.length > 0) {
      const service = services[0];
      return res.json({
        service: {
          id: service.id,
          name: service.name
        },
        valid: true
      });
    }

    // Internal platform/worker tokens are not stored in the service registry
    // but are trusted by the conductor proxy (appProxyAuth). Accept them here
    // too so services can validate them (key_manager, storage_manager, ...).
    const internalTokens = [
      process.env.WORKER_REGISTRATION_TOKEN,
      process.env.WORKER_TOKEN,
      process.env.CONDUCTOR_TOKEN
    ].filter(Boolean);
    if (internalTokens.includes(token)) {
      return res.json({
        service: { id: 'worker', name: 'worker' },
        valid: true,
        internal: true
      });
    }

    return res.status(401).json({
      error: {
        message: 'Invalid service token',
        status: 401
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/services/register
 * Register a service instance (called by services themselves)
 * No authentication required - services register themselves
 */
router.post('/register', async (req, res, next) => {
  try {
    const { name, version, port, health_endpoint, ready_endpoint, capabilities, metadata } = req.body;
    
    if (!name) {
      return res.status(400).json({
        error: {
          message: 'Service name is required',
          status: 400
        }
      });
    }
    
    // Find or create service
    let services = await Service.findAll({ where: { name } });
    let service;
    
    if (services.length === 0) {
      // Create new service
      const serviceToken = randomUUID();
      service = await Service.create({
        name,
        enabled: 1,
        docker_image: `aerekos-${name}:latest`,
        config: JSON.stringify({
          version,
          port,
          health_endpoint,
          ready_endpoint,
          capabilities,
          metadata
        }),
        service_token: serviceToken
      });
    } else {
      service = services[0];
      const nextConfig = {
        version,
        port,
        health_endpoint,
        ready_endpoint,
        capabilities,
        metadata
      };
      let serviceToken = service.service_token;
      if (!serviceToken) {
        serviceToken = randomUUID();
      }
      await Service.update(service.id, {
        service_token: serviceToken,
        config: JSON.stringify(nextConfig)
      });
      service.service_token = serviceToken;
    }
    
    res.status(200).json({
      service_id: service.id,
      service_token: service.service_token,
      name: service.name
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/services
 * Get all available services
 * Protected route
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const services = await Service.findAll();
    const placements = await serviceManager.listPlacements().catch(() => ({}));

    res.json({
      services: services.map(service => ({
        id: service.id,
        name: service.name,
        docker_image: service.docker_image,
        enabled: service.enabled === 1,
        config: service.config,
        created_at: service.created_at,
        updated_at: service.updated_at,
        ...(placements[service.name] || {}),
      }))
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/services/registry/:serviceName
 * Lookup a registered service by name (admin UI / tooling).
 */
router.get('/registry/:serviceName', authenticate, async (req, res, next) => {
  try {
    const { serviceName } = req.params;
    const rows = await Service.findAll({ where: { name: serviceName } });
    if (rows.length === 0) {
      return res.status(404).json({
        error: { message: 'Service not found', status: 404 }
      });
    }
    const s = rows[0];
    res.json({
      id: s.id,
      name: s.name,
      docker_image: s.docker_image,
      enabled: s.enabled === 1,
      config: s.config,
      created_at: s.created_at,
      updated_at: s.updated_at
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/services/:serviceName/setup?project_id=
 * Setup wizard status (dependencies, secrets, progress).
 */
router.get('/:serviceName/setup', authenticate, async (req, res, next) => {
  try {
    const { serviceName } = req.params;
    const projectId = req.query.project_id || req.body?.project_id;
    const setup = await SetupService.getServiceSetup(
      serviceName,
      projectId,
      req.headers.authorization,
    );
    res.json(setup);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/services/:serviceName/enable
 * Enable a service (deploy to worker)
 */
router.post('/:serviceName/enable', authenticate, async (req, res, next) => {
  try {
    const { serviceName } = req.params;
    const { worker_id } = req.body;
    const projectId = req.query.project_id || req.body.project_id;

    const result = await serviceManager.enableService(serviceName, worker_id, projectId);

    res.json({
      success: true,
      service: serviceName,
      ...result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/services/:serviceName/disable
 * Disable a service (stop and remove)
 */
router.post('/:serviceName/disable', authenticate, async (req, res, next) => {
  try {
    const { serviceName } = req.params;

    const result = await serviceManager.disableService(serviceName);

    res.json({
      success: true,
      service: serviceName,
      ...result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/services/:serviceName/status
 * Get service status
 */
router.get('/:serviceName/status', authenticate, async (req, res, next) => {
  try {
    const { serviceName } = req.params;

    const status = await serviceManager.getServiceStatus(serviceName);

    res.json(status);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/services/:serviceName/instances
 * Get all instances of a service
 */
router.get('/:serviceName/instances', authenticate, async (req, res, next) => {
  try {
    const { serviceName } = req.params;
    const projectId = req.query.project_id || req.body?.project_id;

    const instances = await serviceManager.getServiceInstances(serviceName, projectId || null);

    res.json({
      service: serviceName,
      project_id: projectId || null,
      instances
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/services/:serviceId/projects
 * Get all projects for a service
 * Protected route
 */
router.get('/:serviceId/projects', authenticate, async (req, res, next) => {
  try {
    const { serviceId } = req.params;
    
    // Verify service exists
    const services = await Service.findAll({ where: { id: serviceId } });
    if (services.length === 0) {
      return res.status(404).json({
        error: {
          message: 'Service not found',
          status: 404
        }
      });
    }

    const projects = await ProjectService.getServiceProjects(serviceId);

    res.json({
      projects: projects.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        enabled: p.enabled === 1,
        created_at: p.created_at,
        updated_at: p.updated_at
      }))
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Proxy routes for storage_manager signed URLs
 * Routes under /api/services/storage_manager/signed/* are proxied directly to storage_manager
 * These routes don't require authentication (they use signed URLs with HMAC signatures)
 * IMPORTANT: This route must be registered BEFORE /storage_manager/api to ensure signed URLs are matched first
 */
router.use('/storage_manager/signed', async (req, res, next) => {
  console.log(`[signed-url-proxy] Route matched: ${req.method} ${req.originalUrl}, path: ${req.path}`);
  try {
    // Extract projectId from signed URL path
    // Signed URLs have format: /signed/:signature/:fileId/:bucketId/:urlType
    // req.path will be like "/signed/abc123/fileId/bucketId/upload" (Express strips the matched prefix)
    // req.originalUrl will be "/api/services/storage_manager/signed/abc123/fileId/bucketId/upload"
    let projectId = req.query.project_id || req.headers['x-project-id'];
    
    // If not found, extract bucketId from path and find any deployment to get projectId
    // The storage_manager will validate the signature anyway, so we just need projectId for routing
    if (!projectId) {
      // Use req.path (which has /signed/ prefix) or req.originalUrl
      const pathToCheck = req.path.startsWith('/signed/') ? req.path : req.originalUrl;
      const pathMatch = pathToCheck.match(/\/signed\/[^\/]+\/[^\/]+\/([^\/]+)\//);
      if (pathMatch && pathMatch[1]) {
        const bucketId = pathMatch[1];
        // Find any deployment for storage_manager to get a projectId for routing
        // The actual validation happens in storage_manager via the signature
        const { Service, ServiceDeployment } = require('../models');
        const services = await Service.findAll({ where: { name: 'storage_manager' } });
        if (services.length > 0) {
          const deployments = await ServiceDeployment.findAll({
            where: {
              service_id: services[0].id,
              status: 'deployed'
            },
            limit: 1
          });
          if (deployments.length > 0) {
            projectId = deployments[0].project_id;
          }
        }
      }
    }
    
    // Keep the full path including /api/services/storage_manager/signed/... for storage_manager
    // req.path will be "/signed/..." after Express strips the matched prefix "/storage_manager/signed"
    // req.originalUrl will be "/api/services/storage_manager/signed/..."
    // We need to pass the FULL path "/api/services/storage_manager/signed/..." to storage_manager
    let path = req.originalUrl;
    
    // Ensure path starts with /api/services/storage_manager/signed/
    if (!path.startsWith('/api/services/storage_manager/signed/')) {
      // If originalUrl doesn't have the full path, construct it
      // req.path should be "/signed/..." after Express strips "/storage_manager/signed"
      const signedPart = req.path.startsWith('/signed/') ? req.path : '/signed' + req.path;
      path = `/api/services/storage_manager${signedPart}`;
    }
    
    // Preserve query string
    if (Object.keys(req.query).length > 0) {
      const queryString = new URLSearchParams(req.query).toString();
      path = path.split('?')[0] + '?' + queryString;
    }
    
    console.log(`[signed-url-proxy] Proxying to storage_manager: ${req.method} ${path} (originalUrl: ${req.originalUrl}, req.path: ${req.path})`);
    const method = req.method;
    
    // For PUT/POST requests, we need to stream the body
    const isStreamingRequest = (method === 'PUT' || method === 'POST') && req.headers['content-type'];
    
    const clientIp = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0];
    
    // Clean up duplicate query params (can happen when proxying)
    const cleanQuery = {};
    Object.keys(req.query).forEach(key => {
      const value = req.query[key];
      cleanQuery[key] = Array.isArray(value) ? value[0] : value;
    });
    
    // Proxy to storage_manager - signed URLs handle their own authentication
    const result = await serviceManager.proxyServiceRequest(
      'storage_manager',
      method,
      path,
      isStreamingRequest ? req : (req.body && Object.keys(req.body).length > 0 ? req.body : null),
      cleanQuery, // Use cleaned query params
      projectId,
      { 
        clientIp,
        stream: isStreamingRequest ? req : null // Pass request stream for file uploads
      }
    );
    
    res.status(result.status);
    if (result.headers) {
      Object.keys(result.headers).forEach(key => {
        res.setHeader(key, result.headers[key]);
      });
    }
    res.json(result.data);
  } catch (error) {
    console.error(`[signed-url-proxy] Error:`, error.message, error.stack);
    if (error.response) {
      // Axios error with response
      console.error(`[signed-url-proxy] Response status:`, error.response.status);
      console.error(`[signed-url-proxy] Response data:`, error.response.data);
      return res.status(error.response.status || 500).json(error.response.data || {
        error: {
          message: error.message,
          status: error.response.status || 500,
          code: 'PROXY_ERROR'
        }
      });
    }
    if (error.status) {
      return res.status(error.status).json({
        error: {
          message: error.message,
          status: error.status,
          code: error.code || 'SERVICE_ERROR'
        }
      });
    }
    console.error(`[signed-url-proxy] Unexpected error:`, error);
    return res.status(500).json({
      error: {
        message: error.message || 'Internal server error',
        status: 500,
        code: 'INTERNAL_ERROR'
      }
    });
  }
});

/**
 * Proxy routes for storage_manager API
 * All routes under /api/services/storage_manager/api/* are proxied to storage_manager service
 * Maps /api/services/storage_manager/api/* to storage_manager's /api/* endpoints
 * Example: /api/services/storage_manager/api/projects -> /api/projects
 */
router.use('/storage_manager/api', appProxyAuth, async (req, res, next) => {
  try {
    // Remove /storage_manager/api prefix from path
    let path = req.path.replace('/storage_manager/api', '');
    
    // Ensure path starts with /api to match storage_manager's route structure
    if (!path.startsWith('/api')) {
      path = '/api' + (path || '');
    }
    
    // Handle root case
    if (path === '/api') {
      path = '/api/projects'; // Default to projects endpoint
    }
    
    const method = req.method;
    const data = req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body) && Object.keys(req.body).length > 0 ? req.body : null;
    const query = req.query;

    // Extract projectId from multiple sources (priority order):
    // 1. URL path: /api/projects/{projectId}/buckets
    // 2. Request body: project_id
    // 3. Query parameter: project_id
    // 4. Header: x-project-id
    let projectId = (data && data.project_id) || req.query.project_id || req.headers['x-project-id'];
    
    // If not found, try to extract from path pattern: /api/projects/{projectId}/...
    if (!projectId && path.includes('/projects/')) {
      const pathMatch = path.match(/\/api\/projects\/([a-f0-9-]{36})/);
      if (pathMatch && pathMatch[1]) {
        projectId = pathMatch[1];
      }
    }
    
    // Check if this is a file download request (GET request to /files endpoint)
    const isFileDownload = method === 'GET' && path.includes('/files/') && !path.includes('/files?');
    const contentType = req.headers['content-type'] || '';
    const isFileUpload =
      (method === 'POST' || method === 'PUT' || method === 'PATCH')
      && path.includes('/files/')
      && (contentType.includes('octet-stream') || contentType.includes('multipart/'));
    
    const clientIp = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0];
    const optHeaders = {};
    if (req.id) optHeaders['X-Request-Id'] = req.id;
    if (req.headers['x-project-id']) optHeaders['X-Project-Id'] = req.headers['x-project-id'];
    if (req.headers['x-aerekos-resource']) optHeaders['X-Aerekos-Resource'] = req.headers['x-aerekos-resource'];
    const proxyAuth = await authorizationForProxy(req, 'storage_manager');
    if (proxyAuth) optHeaders.Authorization = `Bearer ${proxyAuth}`;

    // Stream binary uploads; express.json does not consume octet-stream/multipart.
    if (isFileUpload) {
      if (req.headers['content-type']) optHeaders['Content-Type'] = req.headers['content-type'];
      if (req.headers['content-length']) optHeaders['Content-Length'] = req.headers['content-length'];
      const result = await serviceManager.proxyServiceRequest('storage_manager', method, path, null, query, projectId, {
        clientIp,
        headers: optHeaders,
        stream: req,
      });
      return res.status(result.status).json(result.data);
    }

    // For file downloads, use arraybuffer response type and stream directly
    if (isFileDownload) {
      const result = await serviceManager.proxyServiceRequest('storage_manager', method, path, data, query, projectId, { 
        clientIp,
        headers: Object.keys(optHeaders).length ? optHeaders : undefined,
        responseType: 'arraybuffer' // Request binary data for file downloads
      });
      
      // Set headers from response
      if (result.headers) {
        Object.keys(result.headers).forEach(key => {
          res.setHeader(key, result.headers[key]);
        });
      }
      
      // Send binary data directly
      res.status(result.status);
      if (Buffer.isBuffer(result.data)) {
        res.send(result.data);
      } else if (result.data instanceof ArrayBuffer) {
        res.send(Buffer.from(result.data));
      } else {
        res.send(result.data);
      }
      return;
    }
    
    // For non-download requests, handle JSON responses
    const result = await serviceManager.proxyServiceRequest('storage_manager', method, path, data, query, projectId, {
      clientIp,
      headers: Object.keys(optHeaders).length ? optHeaders : undefined,
    });

    // Rewrite signed URLs to use public-facing conductor URL (for browser compatibility)
    // Replace host.docker.internal with localhost in signed URLs
    let responseData = result.data;
    if (responseData && typeof responseData === 'object') {
      if (responseData.url && typeof responseData.url === 'string') {
        responseData.url = responseData.url.replace('host.docker.internal:3000', 'localhost:3000');
        responseData.url = responseData.url.replace('host.docker.internal', 'localhost');
      }
      // Also check nested objects (e.g., if response has nested signed URLs)
      if (responseData.signed_urls && Array.isArray(responseData.signed_urls)) {
        responseData.signed_urls = responseData.signed_urls.map(url => {
          if (typeof url === 'object' && url.url) {
            url.url = url.url.replace('host.docker.internal:3000', 'localhost:3000');
            url.url = url.url.replace('host.docker.internal', 'localhost');
          }
          return url;
        });
      }
    }

    res.status(result.status).json(responseData);
  } catch (error) {
    // Handle service unavailable errors gracefully
    if (error.status) {
      return res.status(error.status).json({
        error: {
          message: error.message,
          status: error.status,
          code: error.code || 'SERVICE_ERROR'
        }
      });
    }
    
    // Handle connection errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return res.status(503).json({
        error: {
          message: `Storage Manager service is not reachable. Please ensure the service is enabled and running.`,
          status: 503,
          code: 'SERVICE_UNREACHABLE'
        }
      });
    }
    
    next(error);
  }
});

/**
 * Proxy routes for db_manager API
 * All routes under /api/services/db_manager/api/* are proxied to db_manager service
 * Maps /api/services/db_manager/api/* to db_manager's /api/* endpoints
 * Example: /api/services/db_manager/api/databases -> /api/databases
 * Supports both user authentication (JWT) and service authentication (service token)
 * Note: db_manager is project-scoped (databases belong to projects)
 */
router.use('/db_manager/api', appProxyAuth, async (req, res, next) => {
  try {
    // Extract projectId from query params, or get user's first project
    let projectId = req.query.project_id;
    
    // If no project_id provided, get user's first project (human JWT only)
    if (!projectId && req.user && (req.userId || req.user.id)) {
      const { Project } = require('../models');
      const projects = await Project.findAll();
      if (projects.length > 0) {
        projectId = projects[0].id;
        console.log(`[db_manager-proxy] No project_id provided, using default project: ${projectId}`);
      }
    }
    if (!projectId && req.isAppCredential && req.auth?.project_id) {
      projectId = req.auth.project_id;
    }
    
    if (!projectId) {
      return res.status(400).json({
        error: {
          message: 'project_id is required for db_manager API. All services are project-scoped. No projects found.',
          status: 400,
          code: 'PROJECT_ID_REQUIRED'
        }
      });
    }
    
    // Remove /db_manager/api prefix from path
    // req.path will be like "/db_manager/api/databases" or "/db_manager/api/databases/my-db"
    // We need to map it to "/api/databases" or "/api/databases/my-db"
    let path = req.path.replace('/db_manager/api', '');
    
    // Ensure path starts with /api to match db_manager's route structure
    if (!path.startsWith('/api')) {
      path = '/api' + (path || '');
    }
    
    // Handle root case
    if (path === '/api') {
      path = '/api/databases'; // Default to databases endpoint
    }
    
    const method = req.method;
    const data = req.body && Object.keys(req.body).length > 0 ? req.body : null;
    // Include project_id in query params for db_manager
    const query = { ...req.query, project_id: projectId };

    // db_manager is project-scoped, use proxyServiceRequest with projectId
    const clientIp = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0];
    const optHeaders = {};
    if (req.id) optHeaders['X-Request-Id'] = req.id;
    if (req.headers['x-project-id']) optHeaders['X-Project-Id'] = req.headers['x-project-id'];
    const proxyAuth = await authorizationForProxy(req, 'db_manager');
    if (proxyAuth) optHeaders.Authorization = `Bearer ${proxyAuth}`;
    const result = await serviceManager.proxyServiceRequest('db_manager', method, path, data, query, projectId, { 
      clientIp,
      headers: Object.keys(optHeaders).length ? optHeaders : undefined,
    });

    res.status(result.status).json(result.data);
  } catch (error) {
    // Handle service unavailable errors gracefully
    if (error.status) {
      return res.status(error.status).json({
        error: {
          message: error.message,
          status: error.status,
          code: error.code || 'SERVICE_ERROR'
        }
      });
    }
    
    // Handle connection errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return res.status(503).json({
        error: {
          message: `Database Manager service is not reachable. Please ensure the service is enabled and running.`,
          status: 503,
          code: 'SERVICE_UNREACHABLE'
        }
      });
    }
    
    next(error);
  }
});

/**
 * Generic service HTTP API — all managers use /api/services/:serviceName/api/…
 * (auth + request logging at conductor; forwards X-Request-Id). Exceptions above:
 * storage signed URLs, storage_manager/api (file streaming / signed URL rewrites), db_manager/api (JWT forward).
 */

router.use(
  '/:serviceName/api',
  (req, res, next) => {
    if (['validate-token', 'register'].includes(req.params.serviceName)) {
      return res.status(404).json({ error: { message: 'Not found', status: 404 } });
    }
    const url = req.originalUrl || req.url || req.path || '';
    if (req.params.serviceName === 'auth_manager' && url.includes('/auth/token')) {
      return next();
    }
    return appProxyAuth(req, res, next);
  },
  requireIamAccess(),
  async (req, res, next) => {
    try {
      const { serviceName } = req.params;
      const path = buildServiceProxyPath(serviceName, req.path);
      const method = req.method;
      const data = req.body && Object.keys(req.body).length > 0 ? req.body : null;
      const query = { ...req.query };
      const projectId = data?.project_id || query.project_id || req.headers['x-project-id'];
      // billing_manager evaluate-quota is itself a POST through this proxy.
      // Checking quota on that call recurses forever and starves login.
      const skipQuotaSvc = serviceName === 'billing_manager' || serviceName === 'slack_manager';
      if (projectId && !skipQuotaSvc && ['POST', 'PUT', 'PATCH'].includes(String(method).toUpperCase()) && process.env.SKIP_QUOTA !== '1') {
        try {
          const { requireShared } = require('../utils/loadWorkerShared');
          const { assertQuota } = requireShared('quotaGate');
          const meter = serviceName === 'storage_manager' ? 'storage_bytes'
            : serviceName === 'compute_manager' ? 'compute_tasks'
            : serviceName === 'git_manager' ? 'git_repos'
            : 'manager_writes';
          await assertQuota(projectId, meter);
        } catch (qe) {
          if (qe.status === 429) {
            return res.status(429).json({ error: { message: qe.message, code: 'QUOTA_EXCEEDED', status: 429 } });
          }
        }
      }
      const clientIp = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0];
      const optHeaders = {};
      if (req.id) {
        optHeaders['X-Request-Id'] = req.id;
      }
      if (req.headers['x-project-id']) {
        optHeaders['X-Project-Id'] = req.headers['x-project-id'];
      }
      const proxyAuth = await authorizationForProxy(req, serviceName);
      if (proxyAuth) {
        optHeaders.Authorization = `Bearer ${proxyAuth}`;
      }
      const isTtsAudio = method === "POST" && path.includes("/tts/synthesize");
      const isSlowAi =
        method === "POST"
        && (path.includes("/llm/chat") || path.includes("/intelligence/") || path.includes("/rag/") || path.includes("/embeddings") || path.includes("/memory/") || path.includes("/stt/") || path.includes("/tts/"));
      const slowAiTimeout = parseInt(process.env.CONDUCTOR_PROXY_TIMEOUT_MS || '120000', 10);
      const result = await serviceManager.proxyServiceRequest(serviceName, method, path, data, query, projectId, {
        clientIp,
        headers: Object.keys(optHeaders).length ? optHeaders : undefined,
        responseType: isTtsAudio ? "arraybuffer" : undefined,
        timeout: isSlowAi ? slowAiTimeout : undefined,
      });

      // Single writer (infra-as-code): mirror successful mutating calls to a
      // P4 manager into the project stack, so the project's infra file always
      // matches live state (covers CLI/SDK direct writes, not just click-ops).
      if (projectId && result.status >= 200 && result.status < 400 &&
          ['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(method).toUpperCase())) {
        require('../services/StackService').recordProxyWrite(projectId, serviceName, method, req.path, data, result.data);
      }

      const ct = (result.headers && (result.headers['content-type'] || result.headers['Content-Type'])) || '';
      const isBinary =
        isTtsAudio
        || ct.includes('audio/')
        || Buffer.isBuffer(result.data)
        || result.data instanceof ArrayBuffer;
      if (isBinary) {
        res.status(result.status);
        if (result.headers) {
          Object.keys(result.headers).forEach((k) => {
            if (k.toLowerCase() === 'transfer-encoding') return;
            res.setHeader(k, result.headers[k]);
          });
        }
        if (!res.getHeader('Content-Type')) {
          res.setHeader('Content-Type', ct.includes('audio/') ? ct : 'audio/wav');
        }
        if (Buffer.isBuffer(result.data)) return res.send(result.data);
        if (result.data instanceof ArrayBuffer) return res.send(Buffer.from(result.data));
        return res.send(result.data);
      }
      if (ct.includes('text/plain') || (typeof result.data === 'string' && !ct.includes('json'))) {
        res.status(result.status);
        if (result.headers) {
          Object.keys(result.headers).forEach((k) => {
            if (k.toLowerCase() === 'transfer-encoding') return;
            res.setHeader(k, result.headers[k]);
          });
        }
        return res.send(result.data);
      }
      return res.status(result.status).json(result.data);
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({
          error: {
            message: error.message,
            status: error.status,
            code: error.code || 'SERVICE_ERROR'
          }
        });
      }
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        return res.status(503).json({
          error: {
            message: `Service is not reachable. Ensure it is enabled and running.`,
            status: 503,
            code: 'SERVICE_UNREACHABLE'
          }
        });
      }
      return next(error);
    }
  }
);
/**
 * GET /api/services/:serviceName/health — any registered manager
 */
router.get('/:serviceName/health', authenticateService, async (req, res, next) => {
  try {
    const { serviceName } = req.params;
    const projectId = req.query.project_id || req.headers['x-project-id'];
    const clientIp = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0];
    const optHeaders = req.id ? { 'X-Request-Id': req.id } : undefined;
    const result = projectId
      ? await serviceManager.proxyServiceRequest(serviceName, 'GET', '/health', null, {}, projectId, {
        clientIp,
        headers: optHeaders
      })
      : await serviceManager.proxyServiceRequestWithoutProject(serviceName, 'GET', '/health', null, {}, {
        clientIp,
        headers: optHeaders
      });
    return res.status(result.status).json(result.data);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        error: {
          message: error.message,
          status: error.status
        }
      });
    }
    return next(error);
  }
});

/**
 * GET /api/services/:serviceName/metrics — Prometheus text when the worker exposes /metrics
 */
router.get('/:serviceName/metrics', authenticate, async (req, res, next) => {
  try {
    const { serviceName } = req.params;
    const projectId = req.query.project_id || req.headers['x-project-id'];
    const clientIp = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0];
    const result = await serviceManager.proxyServiceRequest(serviceName, 'GET', '/metrics', null, {}, projectId, {
      clientIp,
      headers: req.id ? { 'X-Request-Id': req.id } : undefined
    });
    res.status(result.status);
    if (result.headers) {
      Object.keys(result.headers).forEach((k) => {
        if (k.toLowerCase() === 'transfer-encoding') return;
        res.setHeader(k, result.headers[k]);
      });
    }
    if (typeof result.data === 'string') {
      return res.send(result.data);
    }
    return res.json(result.data);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        error: {
          message: error.message,
          status: error.status
        }
      });
    }
    return next(error);
  }
});

module.exports = router;
