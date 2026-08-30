'use strict';

const ServiceManager = require('./ServiceManager');
const WorkerRepository = require('../repos/WorkerRepository');
const { authorizationForProxy } = require('../utils/proxyAuthorization');
const { requireShared } = require('../utils/loadWorkerShared');

const arn = requireShared('arn');
const scope = requireShared('scope');

const PROJECT_ID_RE = /\/v1\/projects\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\//i;

function projectIdFromPath(path) {
  const m = String(path || '').match(PROJECT_ID_RE);
  return m ? m[1] : null;
}

class GatewayService {
  constructor(deps = {}) {
    this.serviceManager = deps.serviceManager || ServiceManager.getInstance(WorkerRepository);
    this._cache = new Map();
    this.ttlMs = parseInt(process.env.GATEWAY_ROUTE_CACHE_TTL_MS || '30000', 10);
  }

  cacheKey(method, path) {
    return `${method}|${path}`;
  }

  async resolveRoute(method, path) {
    const key = this.cacheKey(method, path);
    const hit = this._cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.match;

    const routeProjectId = projectIdFromPath(path);
    const result = await this.serviceManager.proxyServiceRequest(
      'api_manager',
      'POST',
      '/api/v1/endpoints/match',
      { method, path },
      {},
      routeProjectId,
    );

    const match = result.data?.match || null;
    this._cache.set(key, { match, expires: Date.now() + this.ttlMs });
    return match;
  }

  assertAppAccess(req, match) {
    if (!req.isAppCredential || !req.auth) return null;

    const resourceArn = match.resource_arn;

    if (match.required_scope && !scope.hasScope(req.auth.scope || req.auth.scopes, match.required_scope)) {
      return {
        status: 403,
        body: {
          error: {
            code: 'InsufficientScope',
            message: `required scope: ${match.required_scope}`,
            resource: resourceArn,
            status: 403,
          },
        },
      };
    }

    if (match.resolve_arn_at === 'target' || !resourceArn) {
      return null;
    }
    const allowed = req.auth.resources || [];
    if (!arn.isAllowed(allowed, resourceArn)) {
      return {
        status: 403,
        body: {
          error: {
            code: 'ResourceNotAllowed',
            message: 'credential is not authorized for this resource',
            resource: resourceArn,
            status: 403,
          },
        },
      };
    }
    return null;
  }

  async proxyRequest(req, res) {
    const path = req.originalUrl.split('?')[0];
    const match = await this.resolveRoute(req.method, path);
    if (!match) {
      return res.status(404).json({
        error: { code: 'RouteNotFound', message: 'no API gateway route matches this path', status: 404 },
      });
    }

    const denied = this.assertAppAccess(req, match);
    if (denied) return res.status(denied.status).json(denied.body);

    const serviceName = match.target_service;
    const proxyPath = match.target_path;
    const projectId = match.project_id || match.params?.project_id || projectIdFromPath(path);
    if (!projectId) {
      return res.status(400).json({
        error: {
          code: 'ProjectRequired',
          message: 'project_id could not be resolved from gateway path',
          status: 400,
        },
      });
    }
    const injectResource = match.resource_arn && match.resolve_arn_at !== 'target';
    const data =
      req.body && typeof req.body === 'object' && Object.keys(req.body).length
        ? {
            ...req.body,
            ...(injectResource && !req.body.resource ? { resource: match.resource_arn } : {}),
          }
        : req.method !== 'GET' && req.method !== 'HEAD' && injectResource
          ? { resource: match.resource_arn }
          : req.body && Object.keys(req.body).length
            ? req.body
            : null;

    const optHeaders = {};
    if (injectResource) {
      optHeaders['X-Aerekos-Resource'] = match.resource_arn;
    }
    if (req.id) optHeaders['X-Request-Id'] = req.id;
    if (projectId) optHeaders['X-Project-Id'] = projectId;

    const proxyAuth = await authorizationForProxy(req, serviceName);
    if (proxyAuth) optHeaders.Authorization = `Bearer ${proxyAuth}`;

    const result = await this.serviceManager.proxyServiceRequest(
      serviceName,
      req.method,
      proxyPath,
      data,
      { ...req.query },
      projectId,
      { clientIp: req.ip, headers: optHeaders },
    );

    const ct = (result.headers && (result.headers['content-type'] || result.headers['Content-Type'])) || '';
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
  }

  clearCache() {
    this._cache.clear();
  }
}

const singleton = new GatewayService();
module.exports = singleton;
module.exports.GatewayService = GatewayService;
