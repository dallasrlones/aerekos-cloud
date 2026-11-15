'use strict';

const MANAGERS = require('./managers.generated.js');

/**
 * aerekos-sdk — a tiny, dependency-free client for the aerekos-cloud conductor API.
 *
 * Uses the global `fetch` (Node 18+, browsers, Deno, Bun). No runtime deps.
 *
 * Quick start:
 *   const { AerekosClient } = require('aerekos-sdk');
 *   const client = new AerekosClient({ baseUrl: 'http://localhost:3000' });
 *   await client.login('admin', 'admin');
 *   const services = await client.services.list();
 *
 *   // Talk to a manager through the conductor proxy:
 *   const key = await client.keys.create('p-123', { name: 'app-key', type: 'symmetric', algorithm: 'aes-256-gcm' });
 *   const buckets = await client.storage.listBuckets('p-123');
 */

class AerekosError extends Error {
  constructor(message, { status, code, body } = {}) {
    super(message);
    this.name = 'AerekosError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

class AerekosClient {
  /**
   * @param {object} opts
   * @param {string} opts.baseUrl  Conductor base URL, e.g. http://localhost:3000
   * @param {string} [opts.token]  Existing JWT or service token (optional).
   * @param {number} [opts.timeoutMs=30000]
   * @param {typeof fetch} [opts.fetch] Custom fetch implementation.
   */
  /**
   * @param {object} opts
   * @param {string} opts.baseUrl  Conductor base URL, e.g. http://localhost:3000
   * @param {string} [opts.token]  Existing JWT or service token (optional).
   * @param {number} [opts.timeoutMs=30000]
   * @param {Record<string,string>} [opts.serviceUrls]  Optional direct manager bases
   *   (e.g. { auth_manager: 'http://host:3116', download_manager: 'http://host:3133' }).
   *   When set, `proxy(service, …)` hits that host + path instead of the conductor proxy.
   * @param {typeof fetch} [opts.fetch] Custom fetch implementation.
   */
  constructor({ baseUrl, token = null, timeoutMs = 30000, serviceUrls = {}, fetch: fetchImpl } = {}) {
    if (!baseUrl) throw new AerekosError('baseUrl is required');
    this.baseUrl = String(baseUrl).replace(/\/+$/, '');
    this.token = token;
    this.timeoutMs = timeoutMs;
    this.serviceUrls = {};
    for (const [k, v] of Object.entries(serviceUrls || {})) {
      if (v) this.serviceUrls[k] = String(v).replace(/\/+$/, '');
    }
    this._fetch = fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
    if (!this._fetch) {
      throw new AerekosError(
        'No fetch implementation found. Use Node 18+ or pass { fetch } explicitly.'
      );
    }

    // Namespaced helpers
    this.auth = new AuthApi(this);
    this.users = new UsersApi(this);
    this.workers = new WorkersApi(this);
    this.services = new ServicesApi(this);
    this.keys = new KeyManagerApi(this);
    this.secrets = new SecretsManagerApi(this);
    this.storage = new StorageManagerApi(this);
    this.intelligence = new IntelligenceApi(this);
    this.stt = new SttApi(this);
    this.tts = new TtsApi(this);
    this.memory = new MemoryApi(this);
    this.agents = new AgentsApi(this);
    this.connectors = new ConnectorsApi(this);
    this.compute = new ComputeApi(this);
    this.balancer = new BalancerApi(this);
    this.gateway = new GatewayApi(this);

    this.llm = new LlmApi(this);
    this.lora = new LoraApi(this);
    this.events = new EventsApi(this);
    this.realtime = new RealtimeApi(this);
    this.download = new DownloadApi(this);
    this.functions = new FunctionsApi(this);
    this.queue = new QueueApi(this);
    this.data = new DataApi(this);
    this.stacks = new StacksApi(this);
    this.db = new ThinProxyApi(this, 'db_manager');
    this.cache = new CacheApi(this);
    this.search = new SearchApi(this);
    this.query = new QueryApi(this);
    this.iot = new IotApi(this);
    this.push = new PushApi(this);
    this.notify = new NotifyApi(this);
    this.config = new ConfigApi(this);
    this.backup = new BackupApi(this);
    this.iac = new IacApi(this);
    this.edge = new EdgeApi(this);
    this.vpc = new VpcApi(this);
    this.setup = new SetupApi(this);
    this.systems = new SystemsApi(this);
    this.graphql = new GraphqlApi(this);
    this.git = new ThinProxyApi(this, 'git_manager');
    this.logs = new ThinProxyApi(this, 'logs_manager');
    this.traces = new ThinProxyApi(this, 'trace_manager');
    this.iam = new IamApi(this);

    // Catalog-driven access to every manager: `client.svc.git_manager`, etc.
    this.svc = {};
    for (const m of MANAGERS) {
      this.svc[m.name] = new ManagerApi(this, m);
    }
  }

  setToken(token) {
    this.token = token;
    return this;
  }

  /** Low-level request against the conductor API (or an absolute override base). */
  async request(method, path, { body, query, headers = {}, raw = false, timeoutMs, baseUrl } = {}) {
    const root = String(baseUrl || this.baseUrl).replace(/\/+$/, '');
    const url = new URL(`${root}${path.startsWith('/') ? path : `/${path}`}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      }
    }

    const finalHeaders = { Accept: 'application/json', ...headers };
    if (this.token && !finalHeaders.Authorization) {
      finalHeaders.Authorization = `Bearer ${this.token}`;
    }
    let payload;
    if (body !== undefined && body !== null) {
      if (
        typeof body === 'string' ||
        body instanceof ArrayBuffer ||
        (typeof Buffer !== 'undefined' && Buffer.isBuffer(body)) ||
        (typeof Uint8Array !== 'undefined' && body instanceof Uint8Array) ||
        (typeof Blob !== 'undefined' && body instanceof Blob)
      ) {
        // Raw/binary body: pass through (string, Buffer, Uint8Array, ArrayBuffer, Blob).
        // JSON is the default for plain objects.
        finalHeaders['Content-Type'] = finalHeaders['Content-Type'] || (typeof body === 'string' ? 'text/plain' : 'application/octet-stream');
        payload = body;
      } else {
        finalHeaders['Content-Type'] = finalHeaders['Content-Type'] || 'application/json';
        payload = JSON.stringify(body);
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || this.timeoutMs);
    let res;
    try {
      res = await this._fetch(url.toString(), {
        method: method.toUpperCase(),
        headers: finalHeaders,
        body: payload,
        signal: controller.signal
      });
    } catch (err) {
      clearTimeout(timer);
      throw new AerekosError(`Request failed: ${err.message}`, { code: 'NETWORK' });
    }
    clearTimeout(timer);

    if (raw) return res;

    const text = await res.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    if (!res.ok) {
      const message =
        (data && data.error && (data.error.message || data.error)) ||
        (data && data.message) ||
        `HTTP ${res.status}`;
      throw new AerekosError(message, { status: res.status, body: data });
    }
    return data;
  }

  get(path, opts) {
    return this.request('GET', path, opts);
  }
  post(path, body, opts = {}) {
    return this.request('POST', path, { ...opts, body });
  }
  patch(path, body, opts = {}) {
    return this.request('PATCH', path, { ...opts, body });
  }
  put(path, body, opts = {}) {
    return this.request('PUT', path, { ...opts, body });
  }
  del(path, opts) {
    return this.request('DELETE', path, opts);
  }

  /**
   * Proxy a request to a manager service through the conductor.
   * Mirrors: {VERB} {CONDUCTOR}/api/services/{name}/api/{servicePath}
   *
   * @param {string} serviceName e.g. 'key_manager'
   * @param {object} opts
   * @param {string} [opts.method='GET']
   * @param {string} opts.path  service-internal path beginning with '/', e.g. '/api/keys'
   * @param {string} [opts.projectId]
   * @param {object} [opts.body]
   * @param {object} [opts.query]
   * @param {object} [opts.headers]
   */
  proxy(serviceName, { method = 'GET', path, projectId, body, query = {}, headers, raw = false, timeoutMs } = {}) {
    if (!serviceName) throw new AerekosError('serviceName is required');
    if (!path) throw new AerekosError('path is required');
    const q = { ...query };
    if (projectId) q.project_id = projectId;
    const direct = this.serviceUrls[serviceName];
    const p = path.startsWith('/') ? path : `/${path}`;
    if (direct) {
      // Hit the manager directly (sibling apps on LAN) while keeping the SDK surface.
      return this.request(method, p, { body, query: q, headers, raw, timeoutMs, baseUrl: direct });
    }
    const full = `/api/services/${serviceName}${p}`;
    return this.request(method, full, { body, query: q, headers, raw, timeoutMs });
  }

  /**
   * Invoke a resource ARN via the pretty gateway URL when possible,
   * otherwise the manager proxy. Body is forwarded as-is plus `resource`.
   */
  invoke({ resourceArn, method = 'POST', body, projectId, headers } = {}) {
    if (!resourceArn) throw new AerekosError('resourceArn is required');
    const parts = String(resourceArn).split(':');
    // arn:aerekos:{project}:ai:{capability}:endpoint/{name}
    const pid = projectId || parts[2];
    const capability = parts[4] || '';
    const rest = parts.slice(5).join(':');
    const name = rest.includes('/') ? rest.split('/').pop() : rest;
    const pathMap = {
      intelligence: `/v1/projects/${pid}/ai/intelligence/${encodeURIComponent(name)}/chat`,
      llm: `/v1/projects/${pid}/ai/llm/${encodeURIComponent(name)}/chat`,
      tts: `/v1/projects/${pid}/ai/tts/${encodeURIComponent(name)}/synthesize`,
      stt: `/v1/projects/${pid}/ai/stt/${encodeURIComponent(name)}/transcribe`,
      embeddings: `/v1/projects/${pid}/ai/embeddings/${encodeURIComponent(name)}`,
    };
    const pretty = pathMap[capability];
    const payload = { ...(body || {}), resource: resourceArn, project_id: pid };
    if (pretty) {
      return this.request(method, pretty, { body: payload, headers });
    }
    return this.proxy('ai_manager', { method, path: '/api/v1/intelligence/chat', projectId: pid, body: payload, headers });
  }

  /** Descriptor for a known manager, or throw. */
  managerInfo(serviceName) {
    const m = MANAGERS.find((x) => x.name === serviceName);
    if (!m) throw new AerekosError(`Unknown manager: ${serviceName}`, { code: 'UNKNOWN_MANAGER' });
    return m;
  }

  /** Catalog-driven access to every manager: `client.svc.git_manager`, etc.
   */
  manager(serviceName) {
    return new ManagerApi(this, this.managerInfo(serviceName));
  }

  async ensure({ projectId, pack, service, defaults = true } = {}) {
    if (!projectId) throw new AerekosError('projectId is required');
    if (pack) {
      return this.post(`/api/setup/packs/${encodeURIComponent(pack)}`, { project_id: projectId, defaults });
    }
    if (!service) throw new AerekosError('pack or service is required');
    return this.post('/api/setup/enable', { project_id: projectId, service, with_dependencies: true, defaults });
  }

  /**
   * Generic CRUD over a manager's project-scoped collection.
   * Works for the uniform SQLite-CRUD managers and any `{base}/{segment}` resource.
   *
   * @param {string} serviceName  e.g. 'metrics_manager'
   * @param {string} segment      e.g. 'series'
   * @param {{base?:string}} [opts]  base path (default from catalog or '/api/v1')
   */
  resource(serviceName, segment, opts = {}) {
    const known = MANAGERS.find((x) => x.name === serviceName);
    const base = opts.base || (known && known.base) || '/api/v1';
    const root = `${base}/${segment}`.replace(/\/+/g, '/');
    const c = this;
    return {
      create: (projectId, body) => c.proxy(serviceName, { method: 'POST', path: root, projectId, body: { project_id: projectId, ...body } }),
      list: (projectId, query) => c.proxy(serviceName, { method: 'GET', path: root, projectId, query }),
      get: (projectId, id, query) => c.proxy(serviceName, { method: 'GET', path: `${root}/${encodeURIComponent(id)}`, projectId, query }),
      update: (projectId, id, body) => c.proxy(serviceName, { method: 'PATCH', path: `${root}/${encodeURIComponent(id)}`, projectId, body }),
      remove: (projectId, id) => c.proxy(serviceName, { method: 'DELETE', path: `${root}/${encodeURIComponent(id)}`, projectId })
    };
  }
}

/** Helper bound to a single manager service (catalog descriptor `m`). */
class ManagerApi {
  constructor(client, m) {
    this.c = client;
    this.descriptor = m;
    this.name = m.name;
  }
  /** Service self-description (`GET {base}/info`). */
  info(projectId) {
    return this.c.proxy(this.name, { path: `${this.descriptor.base}/info`, projectId });
  }
  /** Prometheus metrics (universal liveness). Returns raw text. */
  async metrics(projectId) {
    const res = await this.c.proxy(this.name, { path: '/metrics', projectId, headers: { Accept: 'text/plain' } });
    return res;
  }
  /** Raw proxy to this manager. */
  proxy(opts) {
    return this.c.proxy(this.name, opts);
  }
  /** CRUD over this manager's default collection (uniform-CRUD managers only). */
  resource(segment) {
    const seg = segment || this.descriptor.segment;
    if (!seg) {
      throw new AerekosError(
        `${this.name} has no default CRUD segment; pass one or use .proxy()`,
        { code: 'NO_SEGMENT' }
      );
    }
    return this.c.resource(this.name, seg, { base: this.descriptor.base });
  }
}

class AuthApi {
  constructor(client) {
    this.c = client;
  }
  /** Logs in and stores the JWT on the client. Returns the login response. */
  async login(username, password) {
    const res = await this.c.post('/api/auth/login', { username, password });
    if (res && res.token) this.c.setToken(res.token);
    return res;
  }
  me() {
    return this.c.get('/api/auth/me');
  }
  /**
   * App credential grant. Stores the access token on the client.
   * @param {{ clientId: string, clientSecret: string, projectId: string, scope?: string }} opts
   */
  async getAppToken({ clientId, clientSecret, projectId, scope } = {}) {
    if (!clientId || !clientSecret) throw new AerekosError('clientId and clientSecret are required');
    // Prefer direct auth_manager when serviceUrls.auth_manager is set; else conductor proxy path.
    const res = this.c.serviceUrls.auth_manager
      ? await this.c.proxy('auth_manager', {
          method: 'POST',
          path: '/api/v1/auth/token',
          projectId,
          body: { grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret, scope },
        })
      : await this.c.post(
          '/api/services/auth_manager/api/v1/auth/token',
          { grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret, scope },
          { query: projectId ? { project_id: projectId } : {} }
        );
    const token = res && (res.access_token || res.token);
    if (token) this.c.setToken(token);
    return res;
  }
  createCredential(projectId, body) {
    return this.c.proxy('auth_manager', {
      method: 'POST',
      path: '/api/v1/credentials',
      projectId,
      body: { project_id: projectId, ...body },
    });
  }
}

/**
 * Per-project human user system (auth_manager password grant).
 * Apps authenticate their end-users here instead of storing passwords
 * themselves: create users, then call login() with the user's
 * username+password to get a JWT that auth_manager /auth/verify accepts.
 */
class UsersApi {
  constructor(client) { this.c = client; }
  /** @returns {Promise<{items: any[], users: any[]}>} */
  list(projectId) {
    return this.c.proxy('auth_manager', { path: '/api/v1/users', projectId });
  }
  /** @returns {Promise<{user: any}>} — password is only accepted at create time. */
  create(projectId, body) {
    return this.c.proxy('auth_manager', { method: 'POST', path: '/api/v1/users', projectId, body: { project_id: projectId, ...body } });
  }
  /** @returns {Promise<{user: any}>} */
  get(projectId, id) {
    return this.c.proxy('auth_manager', { path: `/api/v1/users/${encodeURIComponent(id)}`, projectId });
  }
  /** { name?, display_color?, password?, enabled? } — @returns {Promise<{user: any}>} */
  update(projectId, id, body) {
    return this.c.proxy('auth_manager', { method: 'PATCH', path: `/api/v1/users/${encodeURIComponent(id)}`, projectId, body: { project_id: projectId, ...body } });
  }
  /** @returns {Promise<{deleted: boolean, id: string}>} */
  remove(projectId, id) {
    return this.c.proxy('auth_manager', { method: 'DELETE', path: `/api/v1/users/${encodeURIComponent(id)}`, projectId });
  }
  /**
   * Resource-owner password grant.
   * @param {{ username: string, password: string, projectId?: string }} opts
   * @returns {Promise<{token: string, user: any, expires_in: number}>}
   */
  login({ username, password, projectId } = {}) {
    return this.c.proxy('auth_manager', { method: 'POST', path: '/api/v1/auth/login', projectId, body: { project_id: projectId, username, password } });
  }
  /** Introspect a user/app JWT. @returns {Promise<{active:boolean, claims?:object}>} */
  verify(token) {
    return this.c.proxy('auth_manager', { method: 'POST', path: '/api/v1/auth/verify', body: { token } });
  }
  /**
   * Change password: re-auth with current password, then PATCH the user.
   * Uses app/service token already on the client for the update call after login check.
   */
  async changePassword({ projectId, userId, username, currentPassword, newPassword } = {}) {
    if (!projectId || !userId || !username || !currentPassword || !newPassword) {
      throw new AerekosError('projectId, userId, username, currentPassword, and newPassword are required');
    }
    // Prove possession of the current password (throws / non-ok via proxy).
    await this.login({ username, password: currentPassword, projectId });
    return this.update(projectId, userId, { password: newPassword });
  }
}

class WorkersApi {
  constructor(client) {
    this.c = client;
  }
  list() {
    return this.c.get('/api/workers');
  }
  get(id) {
    return this.c.get(`/api/workers/${encodeURIComponent(id)}`);
  }
  resources() {
    return this.c.get('/api/resources');
  }
}

class ServicesApi {
  constructor(client) {
    this.c = client;
  }
  list() {
    return this.c.get('/api/services');
  }
  get(name) {
    return this.c.get(`/api/services/${encodeURIComponent(name)}`);
  }
  enable(name, projectId) {
    return this.c.post(`/api/services/${encodeURIComponent(name)}/enable`, { project_id: projectId });
  }
  disable(name, projectId) {
    return this.c.post(`/api/services/${encodeURIComponent(name)}/disable`, { project_id: projectId });
  }
  deployments(name) {
    return this.c.get(`/api/services/${encodeURIComponent(name)}/deployments`);
  }
  health(name, projectId) {
    return this.c.proxy(name, { method: 'GET', path: '/health', projectId });
  }
}

/** key_manager (KMS) helper. */
class KeyManagerApi {
  constructor(client) {
    this.c = client;
  }
  list(projectId) {
    return this.c.proxy('key_manager', { path: '/api/keys', projectId });
  }
  get(projectId, name) {
    return this.c.proxy('key_manager', { path: `/api/keys/${encodeURIComponent(name)}`, projectId });
  }
  create(projectId, body) {
    return this.c.proxy('key_manager', { method: 'POST', path: '/api/keys', projectId, body });
  }
  rotate(projectId, name) {
    return this.c.proxy('key_manager', {
      method: 'POST',
      path: `/api/keys/${encodeURIComponent(name)}/rotate`,
      projectId
    });
  }
}

/** secrets_manager helper. */
class SecretsManagerApi {
  constructor(client) {
    this.c = client;
  }
  list(projectId) {
    return this.c.proxy('secrets_manager', { path: '/api/v1/secrets', projectId });
  }
  get(projectId, name, { reveal = false } = {}) {
    return this.c.proxy('secrets_manager', {
      path: `/api/v1/secrets/${encodeURIComponent(name)}`,
      projectId,
      query: reveal ? { reveal: 1 } : {}
    });
  }
  set(projectId, body) {
    return this.c.proxy('secrets_manager', { method: 'POST', path: '/api/v1/secrets', projectId, body });
  }
  remove(projectId, name) {
    return this.c.proxy('secrets_manager', {
      method: 'DELETE',
      path: `/api/v1/secrets/${encodeURIComponent(name)}`,
      projectId
    });
  }
}

/** storage_manager (S3-like) helper. */
class StorageManagerApi {
  constructor(client) {
    this.c = client;
  }

  // Encode an object key ('movies/a b.mp4') into a URL path segment.
  static keyToPath(key) {
    return String(key).split('/').map(encodeURIComponent).join('/');
  }

  // ---- Project buckets (routes: /api/projects/:projectId/...) ----
  // NOTE: these use direct service paths. When client.baseUrl points at the
  // storage_manager itself (typical), they hit it directly (S3-style); when it
  // points at the conductor, the conductor's /api/services/storage_manager
  // proxy is what forwards, so prefer baseUrl = the service itself.

  listBuckets(projectId) {
    return this.c.get(`/api/projects/${encodeURIComponent(projectId)}/buckets`);
  }
  createBucket(projectId, body) {
    return this.c.post(`/api/projects/${encodeURIComponent(projectId)}/buckets`, body);
  }
  getBucket(projectId, name) {
    return this.c.get(`/api/projects/${encodeURIComponent(projectId)}/buckets/${encodeURIComponent(name)}`);
  }
  deleteBucket(projectId, name) {
    return this.c.del(`/api/projects/${encodeURIComponent(projectId)}/buckets/${encodeURIComponent(name)}`);
  }
  listObjects(projectId, bucket, query = {}) {
    return this.c.get(`/api/projects/${encodeURIComponent(projectId)}/buckets/${encodeURIComponent(bucket)}/files`, { query });
  }
  uploadObject(projectId, bucket, key, data, { contentType, timeoutMs } = {}) {
    const headers = {};
    if (contentType) headers['Content-Type'] = contentType;
    return this.c.post(
      `/api/projects/${encodeURIComponent(projectId)}/buckets/${encodeURIComponent(bucket)}/files/${StorageManagerApi.keyToPath(key)}`,
      data,
      { headers, timeoutMs }
    );
  }
  async downloadObject(projectId, bucket, key, { range, timeoutMs } = {}) {
    const headers = {};
    if (range) headers['Range'] = range;
    const res = await this.c.request('GET',
      `/api/projects/${encodeURIComponent(projectId)}/buckets/${encodeURIComponent(bucket)}/files/${StorageManagerApi.keyToPath(key)}`,
      { headers, raw: true, timeoutMs });
    const buffer = Buffer.from(await res.arrayBuffer());
    return {
      status: res.status,
      buffer,
      size: buffer.length,
      contentRange: res.headers.get('content-range') || null,
      contentType: res.headers.get('content-type') || null
    };
  }
  headObject(projectId, bucket, key) {
    return this.c.request('HEAD',
      `/api/projects/${encodeURIComponent(projectId)}/buckets/${encodeURIComponent(bucket)}/files/${StorageManagerApi.keyToPath(key)}`,
      { raw: true });
  }
  deleteObject(projectId, bucket, key) {
    return this.c.del(`/api/projects/${encodeURIComponent(projectId)}/buckets/${encodeURIComponent(bucket)}/files/${StorageManagerApi.keyToPath(key)}`);
  }
  getSignedDownloadUrl(projectId, bucket, key, { ttlSeconds = 3600 } = {}) {
    return this.c.post(
      `/api/projects/${encodeURIComponent(projectId)}/buckets/${encodeURIComponent(bucket)}/files/${StorageManagerApi.keyToPath(key)}/signed-url/download`,
      { ttl_seconds: ttlSeconds }
    );
  }

  // ---- System buckets (routes: /api/systems/:systemId/...) ----
  // System buckets may carry a physical base_path (e.g. a 24TB USB media
  // library) so their (encrypted) data lands on a specific disk.

  getSystemBucket(systemId, name) {
    return this.c.get(`/api/systems/${encodeURIComponent(systemId)}/buckets/${encodeURIComponent(name)}`);
  }
  listSystemBuckets(systemId) {
    return this.c.get(`/api/systems/${encodeURIComponent(systemId)}/buckets`);
  }
  listSystems() {
    return this.c.get('/api/systems');
  }
  createSystemBucket(systemId, body) {
    return this.c.post(`/api/systems/${encodeURIComponent(systemId)}/buckets`, body);
  }
  deleteSystemBucket(systemId, name) {
    return this.c.del(`/api/systems/${encodeURIComponent(systemId)}/buckets/${encodeURIComponent(name)}`);
  }
  /** Get the bucket, creating it (with base_path/metadata) if it doesn't exist. */
  async ensureSystemBucket(systemId, name, { base_path, metadata } = {}) {
    try {
      return await this.getSystemBucket(systemId, name);
    } catch (err) {
      if (!err || err.status !== 404) throw err;
      return await this.createSystemBucket(systemId, { name, base_path, metadata });
    }
  }
  listSystemFiles(systemId, bucket, { prefix, maxKeys, delimiter, offset } = {}) {
    const query = {};
    if (prefix !== undefined) query.prefix = prefix;
    if (maxKeys !== undefined) query.maxKeys = maxKeys;
    if (delimiter !== undefined) query.delimiter = delimiter;
    if (offset !== undefined) query.offset = offset;
    return this.c.get(`/api/systems/${encodeURIComponent(systemId)}/buckets/${encodeURIComponent(bucket)}/files`, { query });
  }
  uploadSystemFile(systemId, bucket, key, data, { contentType, timeoutMs } = {}) {
    const headers = {};
    if (contentType) headers['Content-Type'] = contentType;
    return this.c.post(
      `/api/systems/${encodeURIComponent(systemId)}/buckets/${encodeURIComponent(bucket)}/files/${StorageManagerApi.keyToPath(key)}`,
      data,
      { headers, timeoutMs }
    );
  }
  async downloadSystemFile(systemId, bucket, key, { range, timeoutMs } = {}) {
    const headers = {};
    if (range) headers['Range'] = range;
    const res = await this.c.request('GET',
      `/api/systems/${encodeURIComponent(systemId)}/buckets/${encodeURIComponent(bucket)}/files/${StorageManagerApi.keyToPath(key)}`,
      { headers, raw: true, timeoutMs });
    const buffer = Buffer.from(await res.arrayBuffer());
    return {
      status: res.status,
      buffer,
      size: buffer.length,
      contentRange: res.headers.get('content-range') || null,
      contentType: res.headers.get('content-type') || null
    };
  }
  headSystemFile(systemId, bucket, key) {
    return this.c.request('HEAD',
      `/api/systems/${encodeURIComponent(systemId)}/buckets/${encodeURIComponent(bucket)}/files/${StorageManagerApi.keyToPath(key)}`,
      { raw: true });
  }
  deleteSystemFile(systemId, bucket, key) {
    return this.c.del(`/api/systems/${encodeURIComponent(systemId)}/buckets/${encodeURIComponent(bucket)}/files/${StorageManagerApi.keyToPath(key)}`);
  }
  /** S3-style: mint a short-lived signed DOWNLOAD url (phone fetches it directly). */
  getSystemFileSignedUrl(systemId, bucket, key, { ttlSeconds = 900 } = {}) {
    return this.c.post(
      `/api/systems/${encodeURIComponent(systemId)}/buckets/${encodeURIComponent(bucket)}/files/${StorageManagerApi.keyToPath(key)}/signed-url/download`,
      { ttl_seconds: ttlSeconds }
    );
  }
  /** S3-style: mint a one-shot signed UPLOAD url. */
  getSystemFileSignedUploadUrl(systemId, bucket, key, { ttlSeconds = 3600, metadata } = {}) {
    return this.c.post(
      `/api/systems/${encodeURIComponent(systemId)}/buckets/${encodeURIComponent(bucket)}/files/${StorageManagerApi.keyToPath(key)}/signed-url/upload`,
      { ttl_seconds: ttlSeconds, metadata }
    );
  }
}

class GatewayApi {
  constructor(client) {
    this.c = client;
  }
  request(method, prettyPath, body, opts = {}) {
    const path = prettyPath.startsWith('/') ? prettyPath : `/${prettyPath}`;
    return this.c.request(method, path, { body, ...opts });
  }
}

class IntelligenceApi {
  constructor(client) {
    this.c = client;
  }
  list(projectId) {
    return this.c.proxy('ai_manager', { path: '/api/v1/intelligence', projectId });
  }
  create(projectId, body) {
    return this.c.proxy('ai_manager', {
      method: 'POST',
      path: '/api/v1/intelligence',
      projectId,
      body: { project_id: projectId, ...body },
    });
  }
  chat(projectId, body) {
    const name = body?.intelligence || body?.endpoint_name;
    const pretty = name
      ? `/v1/projects/${encodeURIComponent(projectId)}/ai/intelligence/${encodeURIComponent(name)}/chat`
      : null;
    if (pretty && this.c.token) {
      return this.c.request('POST', pretty, { body: { project_id: projectId, ...body } }).catch(() =>
        this.c.proxy('ai_manager', {
          method: 'POST',
          path: '/api/v1/intelligence/chat',
          projectId,
          body: { project_id: projectId, ...body },
        })
      );
    }
    return this.c.proxy('ai_manager', {
      method: 'POST',
      path: '/api/v1/intelligence/chat',
      projectId,
      body: { project_id: projectId, ...body },
    });
  }
  usage(projectId, query = {}) {
    return this.c.proxy('ai_manager', { path: '/api/v1/intelligence/usage', projectId, query });
  }
  attach(projectId, id, body) {
    return this.c.proxy('ai_manager', {
      method: 'POST',
      path: `/api/v1/intelligence/${encodeURIComponent(id)}/attach`,
      projectId,
      body: { project_id: projectId, ...body },
    });
  }
  _jobPretty(projectId, name, suffix) {
    return `/v1/projects/${encodeURIComponent(projectId)}/ai/intelligence/${encodeURIComponent(name)}/jobs${suffix || ''}`;
  }
  async submit(projectId, body = {}) {
    const name = body.intelligence || body.name || body.endpoint_name;
    const payload = { project_id: projectId, ...body };
    const pretty = name ? this._jobPretty(projectId, name, '') : null;
    if (pretty && this.c.token) {
      try {
        return await this.c.request('POST', pretty, { body: payload });
      } catch (_) { /* fall through */ }
    }
    return this.c.proxy('ai_manager', {
      method: 'POST',
      path: '/api/v1/intelligence/jobs',
      projectId,
      body: payload,
    });
  }
  async job(projectId, jobId, { intelligence } = {}) {
    const pretty = intelligence ? this._jobPretty(projectId, intelligence, `/${encodeURIComponent(jobId)}`) : null;
    if (pretty && this.c.token) {
      try {
        return await this.c.request('GET', pretty, { query: { project_id: projectId } });
      } catch (_) { /* fall through */ }
    }
    return this.c.proxy('ai_manager', {
      path: `/api/v1/intelligence/jobs/${encodeURIComponent(jobId)}`,
      projectId,
      query: { project_id: projectId },
    });
  }
  async cancel(projectId, jobId, { intelligence } = {}) {
    const pretty = intelligence ? this._jobPretty(projectId, intelligence, `/${encodeURIComponent(jobId)}/cancel`) : null;
    if (pretty && this.c.token) {
      try {
        return await this.c.request('POST', pretty, { body: { project_id: projectId } });
      } catch (_) { /* fall through */ }
    }
    return this.c.proxy('ai_manager', {
      method: 'POST',
      path: `/api/v1/intelligence/jobs/${encodeURIComponent(jobId)}/cancel`,
      projectId,
      body: { project_id: projectId },
    });
  }
  async wait(projectId, jobId, { intervalMs = 2000, timeoutMs = 30 * 60 * 1000, onUpdate, onDelta } = {}) {
    const started = Date.now();
    let lastPartial = '';
    while (Date.now() - started < timeoutMs) {
      const snap = await this.job(projectId, jobId);
      const row = snap.job || snap;
      if (onUpdate) onUpdate(row);
      const partial = row.partial || '';
      if (onDelta && partial.length > lastPartial.length) {
        onDelta(partial.slice(lastPartial.length));
        lastPartial = partial;
      }
      if (['succeeded', 'failed', 'cancelled'].includes(row.status)) return row;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new AerekosError(`job ${jobId} timed out`, { code: 'TIMEOUT' });
  }
  subscribe(projectId, jobId, { onUpdate, onDelta, baseUrl } = {}) {
    let io;
    try { io = require('socket.io-client'); } catch (e) {
      throw new AerekosError('socket.io-client is required for intelligence.subscribe — npm i socket.io-client', { code: 'NO_SOCKET' });
    }
    const root = (baseUrl || this.c.baseUrl).replace(/\/$/, '');
    const room = `ai:live:${projectId}`;
    const socket = io(`${root}/frontend`, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: { token: this.c.token, projectId },
    });
    const handler = (payload) => {
      if (payload?.job_id && payload.job_id !== jobId && payload.job?.id !== jobId) return;
      if (payload?.delta && onDelta) onDelta(payload.delta, payload.partial);
      if (onUpdate) onUpdate(payload.job || payload);
    };
    socket.on('connect', () => socket.emit('live:subscribe', { room, project_id: projectId }));
    socket.on('ai:job', handler);
    socket.on('ai:job.token', handler);
    return {
      socket,
      close() {
        socket.emit('live:unsubscribe', { room });
        socket.close();
      },
    };
  }
  async attachBalancer(projectId, name, { backends, health_check_path, address } = {}) {
    const addr = address || (Array.isArray(backends) && backends[0]) || 'http://127.0.0.1:11434';
    const lb = await this.c.proxy('balancer_manager', {
      method: 'POST',
      path: '/api/v1/targets',
      projectId,
      body: {
        project_id: projectId,
        name: `intel-${name}`,
        address: addr,
        pool: name,
        health_check_path: health_check_path || '/health',
        health_check_interval: 15,
      },
    });
    const list = await this.list(projectId);
    const items = list.items || list || [];
    const ep = items.find((x) => x.name === name);
    if (!ep) throw new AerekosError(`intelligence endpoint ${name} not found`, { code: 'NOT_FOUND' });
    const balancerId = lb.item?.id || lb.id;
    return this.c.proxy('ai_manager', {
      method: 'POST',
      path: `/api/v1/intelligence/${encodeURIComponent(ep.id)}/attach-balancer`,
      projectId,
      body: { balancer_id: balancerId },
    });
  }
  async detachBalancer(projectId, name) {
    const list = await this.list(projectId);
    const items = list.items || list || [];
    const ep = items.find((x) => x.name === name);
    if (!ep) throw new AerekosError(`intelligence endpoint ${name} not found`, { code: 'NOT_FOUND' });
    return this.c.proxy('ai_manager', {
      method: 'POST',
      path: `/api/v1/intelligence/${encodeURIComponent(ep.id)}/detach-balancer`,
      projectId,
      body: {},
    });
  }
}

class SttApi {
  constructor(client) {
    this.c = client;
  }
  transcribe(projectId, body) {
    return this.c.proxy('ai_manager', {
      method: 'POST',
      path: '/api/v1/stt/transcribe/json',
      projectId,
      body: { project_id: projectId, ...body },
    });
  }
  status(projectId) {
    return this.c.proxy('ai_manager', { path: '/api/v1/stt/status', projectId });
  }
}

class TtsApi {
  constructor(client) {
    this.c = client;
  }
  synthesize(projectId, body, { binary = false } = {}) {
    return this.c.proxy('ai_manager', {
      method: 'POST',
      path: '/api/v1/tts/synthesize',
      projectId,
      body: { project_id: projectId, ...body },
      headers: binary ? { Accept: 'audio/wav, application/octet-stream, application/json' } : undefined,
      raw: binary,
    });
  }
  status(projectId) {
    return this.c.proxy('ai_manager', { path: '/api/v1/tts/status', projectId });
  }
}

class MemoryApi {
  constructor(client) {
    this.c = client;
  }
  stores(projectId) {
    return this.c.proxy('ai_manager', { path: '/api/v1/memory/stores', projectId });
  }
  ingest(projectId, body) {
    return this.c.proxy('ai_manager', {
      method: 'POST',
      path: '/api/v1/memory/ingest',
      projectId,
      body: { project_id: projectId, ...body },
    });
  }
  retrieve(projectId, body) {
    return this.c.proxy('ai_manager', {
      method: 'POST',
      path: '/api/v1/memory/retrieve',
      projectId,
      body: { project_id: projectId, ...body },
    });
  }
}

class AgentsApi {
  constructor(client) {
    this.c = client;
  }
  _p(projectId, path, { method = 'GET', body, query } = {}) {
    return this.c.proxy('ai_manager', {
      method,
      path: `/api/v1/agents${path}`,
      projectId,
      query: { project_id: projectId, ...query },
      body: body != null ? { project_id: projectId, ...body } : undefined,
    });
  }
  setupStatus(projectId) { return this._p(projectId, '/setup/status'); }
  setup(projectId, body = {}) { return this._p(projectId, '/setup', { method: 'POST', body }); }
  settings(projectId) { return this._p(projectId, '/settings'); }
  updateSettings(projectId, body) { return this._p(projectId, '/settings', { method: 'PATCH', body }); }
  fleet(projectId) { return this._p(projectId, '/fleet'); }
  resume(projectId) { return this._p(projectId, '/resume', { method: 'POST', body: {} }); }
  list(projectId) { return this._p(projectId, ''); }
  get(projectId, id) { return this._p(projectId, `/${encodeURIComponent(id)}`); }
  create(projectId, body) { return this._p(projectId, '', { method: 'POST', body }); }
  update(projectId, id, body) { return this._p(projectId, `/${encodeURIComponent(id)}`, { method: 'PATCH', body }); }
  remove(projectId, id) { return this._p(projectId, `/${encodeURIComponent(id)}`, { method: 'DELETE' }); }
  chat(projectId, id, body) { return this._p(projectId, `/${encodeURIComponent(id)}/chat`, { method: 'POST', body }); }
  voice(projectId, id, body) { return this._p(projectId, `/${encodeURIComponent(id)}/voice`, { method: 'POST', body }); }
  interrupt(projectId, id, body = {}) { return this._p(projectId, `/${encodeURIComponent(id)}/interrupt`, { method: 'POST', body }); }
  approve(projectId, id, body) { return this._p(projectId, `/${encodeURIComponent(id)}/approve`, { method: 'POST', body }); }
  pulse(projectId, id) { return this._p(projectId, `/${encodeURIComponent(id)}/pulse`); }
  messages(projectId, id, query) { return this._p(projectId, `/${encodeURIComponent(id)}/messages`, { query }); }
  pins(projectId, id) { return this._p(projectId, `/${encodeURIComponent(id)}/pins`); }
  pin(projectId, id, key, value) { return this._p(projectId, `/${encodeURIComponent(id)}/pins`, { method: 'POST', body: { key, value } }); }
  forget(projectId, id, key) { return this._p(projectId, `/${encodeURIComponent(id)}/pins/${encodeURIComponent(key)}`, { method: 'DELETE' }); }
  exportMemory(projectId, id) { return this._p(projectId, `/${encodeURIComponent(id)}/memory/export`); }
  wipeMemory(projectId, id) { return this._p(projectId, `/${encodeURIComponent(id)}/memory/wipe`, { method: 'POST', body: {} }); }
  rolls(projectId, id) { return this._p(projectId, `/${encodeURIComponent(id)}/rolls`); }
  refreshRolls(projectId, id) { return this._p(projectId, `/${encodeURIComponent(id)}/rolls/refresh`, { method: 'POST', body: {} }); }
  work(projectId, id) { return this._p(projectId, `/${encodeURIComponent(id)}/work`); }
  createWork(projectId, id, body) { return this._p(projectId, `/${encodeURIComponent(id)}/work`, { method: 'POST', body }); }
  asks(projectId, id) { return this._p(projectId, `/${encodeURIComponent(id)}/asks`); }
  workers(projectId, id) { return this._p(projectId, `/${encodeURIComponent(id)}/workers`); }
  spawn(projectId, id, body) { return this._p(projectId, `/${encodeURIComponent(id)}/workers`, { method: 'POST', body }); }
  runWorker(projectId, id, wid, body = {}) { return this._p(projectId, `/${encodeURIComponent(id)}/workers/${encodeURIComponent(wid)}/run`, { method: 'POST', body }); }
  cron(projectId, id) { return this._p(projectId, `/${encodeURIComponent(id)}/cron`); }
  createCron(projectId, id, body) { return this._p(projectId, `/${encodeURIComponent(id)}/cron`, { method: 'POST', body }); }
  fireCron(projectId, id, cid) { return this._p(projectId, `/${encodeURIComponent(id)}/cron/${encodeURIComponent(cid)}/fire`, { method: 'POST', body: {} }); }
  skills(projectId, id) { return this._p(projectId, `/${encodeURIComponent(id)}/skills`); }
  createSkill(projectId, id, body) { return this._p(projectId, `/${encodeURIComponent(id)}/skills`, { method: 'POST', body }); }
  audit(projectId, id) { return this._p(projectId, `/${encodeURIComponent(id)}/audit`); }
  fs(projectId, id, rel) { return this._p(projectId, `/${encodeURIComponent(id)}/fs`, { query: { path: rel || '.' } }); }
  fsWrite(projectId, id, body) { return this._p(projectId, `/${encodeURIComponent(id)}/fs`, { method: 'POST', body }); }
  term(projectId, id, cmd) { return this._p(projectId, `/${encodeURIComponent(id)}/term`, { method: 'POST', body: { cmd } }); }
  tool(projectId, id, body) { return this._p(projectId, `/${encodeURIComponent(id)}/tools`, { method: 'POST', body }); }
  compact(projectId, id) { return this._p(projectId, `/${encodeURIComponent(id)}/compact`, { method: 'POST', body: {} }); }
  plans(projectId, id) { return this._p(projectId, `/${encodeURIComponent(id)}/plans`); }
  plan(projectId, id, planId) { return this._p(projectId, `/${encodeURIComponent(id)}/plans/${encodeURIComponent(planId)}`); }
  consoleEvents(projectId, id, body) {
    return this._p(projectId, `/${encodeURIComponent(id)}/console-events`, { method: 'POST', body });
  }
  timeline(projectId, id, since) { return this._p(projectId, `/${encodeURIComponent(id)}/timeline`, { query: since ? { since } : {} }); }
  prompts(projectId, id) { return this._p(projectId, `/${encodeURIComponent(id)}/prompts`); }
  patchPrompts(projectId, id, prompts) {
    return this._p(projectId, `/${encodeURIComponent(id)}/prompts`, { method: 'PATCH', body: { prompts } });
  }
  resetPrompts(projectId, id) {
    return this._p(projectId, `/${encodeURIComponent(id)}/prompts/reset`, { method: 'POST', body: {} });
  }
  patchWork(projectId, id, workId, body) {
    return this._p(projectId, `/${encodeURIComponent(id)}/work/${encodeURIComponent(workId)}`, { method: 'PATCH', body });
  }
  reorderWork(projectId, id, ids) {
    return this._p(projectId, `/${encodeURIComponent(id)}/work/reorder`, { method: 'POST', body: { ids } });
  }
  browserFrame(projectId, id, frameId) {
    return this._p(projectId, `/${encodeURIComponent(id)}/browser/frames/${encodeURIComponent(frameId)}`);
  }
  prDiff(projectId, id, prId) {
    return this._p(projectId, `/${encodeURIComponent(id)}/prs/${encodeURIComponent(prId)}/diff`);
  }
  subscribeAsks(projectId, agentId, { onAsk, onAnswered, onPulse, onDone, baseUrl } = {}) {
    let io;
    try { io = require('socket.io-client'); } catch (e) {
      throw new AerekosError('socket.io-client is required for agents.subscribeAsks', { code: 'NO_SOCKET' });
    }
    const root = (baseUrl || this.c.baseUrl).replace(/\/$/, '');
    const room = `ai:live:${projectId}`;
    const socket = io(`${root}/frontend`, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: { token: this.c.token, projectId },
    });
    socket.on('connect', () => socket.emit('live:subscribe', { room, project_id: projectId }));
    if (onAsk) {
      socket.on('ai:agent.ask', (payload) => {
        if (agentId && payload?.ask && payload.ask.agent_id && payload.ask.agent_id !== agentId) return;
        onAsk(payload.ask || payload);
      });
    }
    if (onAnswered) {
      socket.on('ai:agent.ask.answered', (payload) => {
        if (agentId && payload?.ask && payload.ask.agent_id && payload.ask.agent_id !== agentId) return;
        onAnswered(payload.ask || payload);
      });
    }
    if (onPulse) socket.on('ai:agent.pulse', (payload) => onPulse(payload.pulse || payload));
    if (onDone) socket.on('ai:agent.done', (payload) => onDone(payload));
    return {
      socket,
      close() {
        socket.emit('live:unsubscribe', { room });
        socket.close();
      },
    };
  }
}

class ConnectorsApi {
  constructor(client) {
    this.c = client;
  }
  kinds() {
    return this.c.proxy('ai_manager', { path: '/api/v1/connectors/kinds' });
  }
  list(projectId) {
    return this.c.proxy('ai_manager', { path: '/api/v1/connectors', projectId, query: { project_id: projectId } });
  }
  get(projectId, id) {
    return this.c.proxy('ai_manager', { path: `/api/v1/connectors/${encodeURIComponent(id)}`, projectId, query: { project_id: projectId } });
  }
  create(projectId, body) {
    return this.c.proxy('ai_manager', {
      method: 'POST', path: '/api/v1/connectors', projectId, body: { project_id: projectId, ...body },
    });
  }
  update(projectId, id, body) {
    return this.c.proxy('ai_manager', {
      method: 'PATCH', path: `/api/v1/connectors/${encodeURIComponent(id)}`, projectId, body: { project_id: projectId, ...body },
    });
  }
  remove(projectId, id) {
    return this.c.proxy('ai_manager', { method: 'DELETE', path: `/api/v1/connectors/${encodeURIComponent(id)}`, projectId });
  }
  invoke(projectId, body) {
    return this.c.proxy('ai_manager', {
      method: 'POST', path: '/api/v1/connectors/invoke', projectId, body: { project_id: projectId, ...body },
    });
  }
}

class ComputeApi {
  constructor(client) {
    this.c = client;
  }
  list(projectId) {
    return this.c.proxy('compute_manager', { path: '/api/v1/tasks', projectId });
  }
  create(projectId, body) {
    return this.c.proxy('compute_manager', {
      method: 'POST',
      path: '/api/v1/tasks',
      projectId,
      body: { project_id: projectId, ...body },
    });
  }
  scale(projectId, taskId, desired) {
    return this.c.proxy('compute_manager', {
      method: 'PATCH',
      path: `/api/v1/tasks/${encodeURIComponent(taskId)}/scale`,
      projectId,
      body: { desired },
    });
  }
  remove(projectId, taskId) {
    return this.c.proxy('compute_manager', {
      method: 'DELETE',
      path: `/api/v1/tasks/${encodeURIComponent(taskId)}`,
      projectId,
    });
  }
}

class BalancerApi {
  constructor(client) {
    this.c = client;
  }
  list(projectId) {
    return this.c.proxy('balancer_manager', { path: '/api/v1/targets', projectId });
  }
  create(projectId, body) {
    return this.c.proxy('balancer_manager', {
      method: 'POST',
      path: '/api/v1/targets',
      projectId,
      body: { project_id: projectId, ...body },
    });
  }
  health(projectId, id) {
    const path = id
      ? `/api/v1/targets/${encodeURIComponent(id)}/health`
      : '/api/v1/targets/health';
    return this.c.proxy('balancer_manager', { path, projectId });
  }
  remove(projectId, id) {
    return this.c.proxy('balancer_manager', {
      method: 'DELETE',
      path: `/api/v1/targets/${encodeURIComponent(id)}`,
      projectId,
    });
  }
}

class LlmApi {
  constructor(client) { this.c = client; }
  chat(projectId, body) {
    return this.c.proxy('ai_manager', { method: 'POST', path: '/api/v1/llm/chat', projectId, body: { project_id: projectId, ...body } });
  }
  models(projectId) {
    return this.c.proxy('ai_manager', { path: '/api/v1/llm/models', projectId });
  }
  status(projectId) {
    return this.c.proxy('ai_manager', { path: '/api/v1/llm/status', projectId });
  }
}

class LoraApi {
  constructor(client) { this.c = client; }
  list(projectId) {
    return this.c.proxy('ai_manager', { path: '/api/v1/lora', projectId });
  }
  train(projectId, body) {
    return this.c.proxy('ai_manager', { method: 'POST', path: '/api/v1/lora/train', projectId, body: { project_id: projectId, ...body } });
  }
  submit(projectId, body) { return this.train(projectId, body); }
  job(projectId, id) {
    return this.c.proxy('ai_manager', { path: `/api/v1/lora/${encodeURIComponent(id)}`, projectId, query: { project_id: projectId } });
  }
  async wait(projectId, id, { intervalMs = 2000, timeoutMs = 12 * 60 * 60 * 1000 } = {}) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const snap = await this.job(projectId, id);
      const status = snap.job?.status || snap.adapter?.status;
      if (['completed', 'failed', 'cancelled'].includes(status)) return snap;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new AerekosError(`lora ${id} timed out`, { code: 'TIMEOUT' });
  }
  attach(projectId, adapterId, intelligence) {
    return this.c.proxy('ai_manager', {
      method: 'POST', path: '/api/v1/lora/attach', projectId,
      body: { project_id: projectId, adapter_id: adapterId, intelligence },
    });
  }
}

class EventsApi {
  constructor(client) { this.c = client; }
  publish(projectId, { type, payload, bus, source } = {}) {
    return this.c.proxy('event_manager', {
      method: 'POST', path: '/api/v1/events', projectId,
      body: { project_id: projectId, type: type || 'ping', payload: payload || {}, bus: bus || 'default', source },
    });
  }
}

class RealtimeApi {
  constructor(client) { this.c = client; }
  publish(projectId, { channel, payload } = {}) {
    return this.c.proxy('websocket_manager', {
      method: 'POST', path: '/api/v1/publish', projectId,
      body: { project_id: projectId, channel: channel || 'app', payload: payload || {} },
    });
  }
  connect({ projectId, channels, baseUrl } = {}) {
    const root = (baseUrl || this.c.baseUrl).replace(/^http/, 'ws');
    const ch = (channels && channels[0]) || 'app';
    const url = `${root.replace(/\/$/, '')}/ws?channel=${encodeURIComponent(ch)}&project_id=${encodeURIComponent(projectId || '')}`;
    return { url, channel: ch, projectId };
  }
}

class DownloadApi {
  constructor(client) { this.c = client; }

  // ---- lists -----------------------------------------------------------------
  lists(projectId) {
    return this.c.proxy('download_manager', { path: '/api/v1/lists', projectId });
  }
  createList(projectId, body) {
    return this.c.proxy('download_manager', { method: 'POST', path: '/api/v1/lists', projectId, body: { project_id: projectId, ...body } });
  }
  getList(projectId, id) {
    return this.c.proxy('download_manager', { path: `/api/v1/lists/${encodeURIComponent(id)}`, projectId });
  }
  updateList(projectId, id, body) {
    return this.c.proxy('download_manager', { method: 'PATCH', path: `/api/v1/lists/${encodeURIComponent(id)}`, projectId, body });
  }
  deleteList(projectId, id) {
    return this.c.proxy('download_manager', { method: 'DELETE', path: `/api/v1/lists/${encodeURIComponent(id)}`, projectId });
  }

  // ---- windows + indexers (simple CRUD) --------------------------------------
  windows(projectId) {
    return this.c.proxy('download_manager', { path: '/api/v1/windows', projectId });
  }
  createWindow(projectId, body) {
    return this.c.proxy('download_manager', { method: 'POST', path: '/api/v1/windows', projectId, body: { project_id: projectId, ...body } });
  }
  indexers(projectId) {
    return this.c.proxy('download_manager', { path: '/api/v1/indexers', projectId });
  }
  createIndexer(projectId, body) {
    return this.c.proxy('download_manager', { method: 'POST', path: '/api/v1/indexers', projectId, body: { project_id: projectId, ...body } });
  }

  // ---- search ----------------------------------------------------------------
  // Torrent search (Jackett if configured, otherwise public-site scrapers).
  // body: { query, category? }  ->  { results: [{title, magnet, size, seeders, site}], source }
  search(projectId, body) {
    return this.c.proxy('download_manager', { method: 'POST', path: '/api/v1/search', projectId, body: { project_id: projectId, ...body } });
  }
  // YouTube search — a separate engine backed by yt-dlp (no API key needed).
  // body: { query, max? }  ->  { results: [{id, url, title, duration, channel, view_count, thumbnail}], source:'youtube', engine:'yt-dlp' }
  searchYouTube(projectId, body) {
    return this.c.proxy('download_manager', { method: 'POST', path: '/api/v1/search/youtube', projectId, body: { project_id: projectId, ...body } });
  }

  // ---- items -----------------------------------------------------------------
  // Quick-add URLs (magnet/torrent/http/youtube) to a list.
  // body: { urls, list?, window?, format?, system_id?, bucket?, prefix? }
  addItems(projectId, body) {
    return this.c.proxy('download_manager', { method: 'POST', path: '/api/v1/quick-add', projectId, body: { project_id: projectId, ...body } });
  }
  quickAdd(opts) {
    return this.addItems(opts.projectId, {
      urls: opts.urls,
      window: opts.window || 'overnight',
      list: opts.list || 'inbox',
      format: opts.format,
      bucket: opts.bucket,
      prefix: opts.prefix,
      system_id: opts.system_id || opts.systemId,
    });
  }
  // Add URLs directly to a specific list.
  addItemsToList(projectId, listId, body) {
    return this.c.proxy('download_manager', { method: 'POST', path: `/api/v1/lists/${encodeURIComponent(listId)}/items`, projectId, body: { project_id: projectId, ...body } });
  }
  listItems(projectId, listId) {
    return this.c.proxy('download_manager', { path: `/api/v1/lists/${encodeURIComponent(listId)}/items`, projectId });
  }
  // All items across lists. query: { list?, status? }
  items(projectId, query = {}) {
    return this.c.proxy('download_manager', { path: '/api/v1/items', projectId, query });
  }
  getItem(projectId, id) {
    return this.c.proxy('download_manager', { path: `/api/v1/items/${encodeURIComponent(id)}`, projectId });
  }
  updateItem(projectId, id, body) {
    return this.c.proxy('download_manager', { method: 'PATCH', path: `/api/v1/items/${encodeURIComponent(id)}`, projectId, body });
  }
  removeItem(projectId, id) {
    return this.c.proxy('download_manager', { method: 'DELETE', path: `/api/v1/items/${encodeURIComponent(id)}`, projectId });
  }
  pauseItem(projectId, id) {
    return this.c.proxy('download_manager', { method: 'POST', path: `/api/v1/items/${encodeURIComponent(id)}/pause`, projectId });
  }
  resumeItem(projectId, id) {
    return this.c.proxy('download_manager', { method: 'POST', path: `/api/v1/items/${encodeURIComponent(id)}/resume`, projectId });
  }
  retryItem(projectId, id) {
    return this.c.proxy('download_manager', { method: 'POST', path: `/api/v1/items/${encodeURIComponent(id)}/retry`, projectId });
  }

  // ---- tick ------------------------------------------------------------------
  // Start pending / resume orphaned items. body: { now? }
  tick(projectId, body) {
    return this.c.proxy('download_manager', { method: 'POST', path: '/api/v1/tick', projectId, body: { project_id: projectId, ...(body || {}) } });
  }
}

class FunctionsApi {
  constructor(client) { this.c = client; }
  deploy(projectId, body) {
    if (projectId && typeof projectId === 'object') {
      const opts = projectId;
      return this.deploy(opts.projectId, opts);
    }
    return this.c.proxy('function_manager', { method: 'POST', path: '/api/v1/functions', projectId, body: { project_id: projectId, trigger: { queue: true }, ...body } });
  }
  invoke(projectId, name, { payload, invocationType } = {}) {
    if (projectId && typeof projectId === 'object') {
      const opts = projectId;
      return this.invoke(opts.projectId, opts.name, opts);
    }
    return this.c.proxy('function_manager', {
      method: 'POST', path: `/api/v1/functions/${encodeURIComponent(name)}/invoke`, projectId,
      body: { project_id: projectId, payload: payload || {}, invocation_type: invocationType || 'RequestResponse' },
    });
  }
  async attachQueue(projectId, name, queueName, { engine } = {}) {
    const list = await this.c.proxy('function_manager', { path: '/api/v1/functions', projectId, query: { project_id: projectId } });
    const items = list.items || list || [];
    const fn = items.find((x) => x.name === name || x.id === name);
    if (!fn) throw new AerekosError(`function ${name} not found`, { code: 'NOT_FOUND' });
    return this.c.proxy('function_manager', {
      method: 'POST',
      path: `/api/v1/functions/${encodeURIComponent(fn.id)}/event-sources`,
      projectId,
      body: { project_id: projectId, kind: 'queue', ref: queueName, engine },
    });
  }
  async detachQueue(projectId, name, sourceId) {
    const list = await this.c.proxy('function_manager', { path: '/api/v1/functions', projectId, query: { project_id: projectId } });
    const items = list.items || list || [];
    const fn = items.find((x) => x.name === name || x.id === name);
    if (!fn) throw new AerekosError(`function ${name} not found`, { code: 'NOT_FOUND' });
    return this.c.proxy('function_manager', {
      method: 'DELETE',
      path: `/api/v1/functions/${encodeURIComponent(fn.id)}/event-sources/${encodeURIComponent(sourceId)}`,
      projectId,
      query: { project_id: projectId },
    });
  }
}

class QueueApi {
  constructor(client) { this.c = client; }
  create(projectId, body) {
    return this.c.proxy('queue_manager', { method: 'POST', path: '/api/v1/queues', projectId, body: { project_id: projectId, engine: 'standard', ...body } });
  }
  list(projectId) {
    return this.c.proxy('queue_manager', { path: '/api/v1/queues', projectId, query: { project_id: projectId } });
  }
  get(projectId, name) {
    return this.c.proxy('queue_manager', { path: `/api/v1/queues/${encodeURIComponent(name)}`, projectId, query: { project_id: projectId } });
  }
  remove(projectId, name) {
    return this.c.proxy('queue_manager', { method: 'DELETE', path: `/api/v1/queues/${encodeURIComponent(name)}`, projectId, query: { project_id: projectId } });
  }
  delete(projectId, name) { return this.remove(projectId, name); }
  stats(projectId, name) { return this.get(projectId, name); }
  send(projectId, { name, body }) {
    return this.c.proxy('queue_manager', { method: 'POST', path: `/api/v1/queues/${encodeURIComponent(name)}/messages`, projectId, body: { project_id: projectId, body } });
  }
  receive(projectId, { name, max } = {}) {
    return this.c.proxy('queue_manager', { method: 'POST', path: `/api/v1/queues/${encodeURIComponent(name)}/messages/receive`, projectId, body: { project_id: projectId, max_number_of_messages: max || 1 } });
  }
}

class DataApi {
  constructor(client) { this.c = client; }
  apply(projectId, modelsJson) {
    return this.c.proxy('api_manager', { method: 'POST', path: '/api/v1/data-apis/apply', projectId, body: { project_id: projectId, ...modelsJson } });
  }
  queryOpts(opts = {}) {
    const q = {};
    if (opts.where != null) q.where = typeof opts.where === 'string' ? opts.where : JSON.stringify(opts.where);
    if (opts.include != null) q.include = Array.isArray(opts.include) ? opts.include.join(',') : String(opts.include);
    if (opts.order) q.order = opts.order;
    if (opts.desc) q.desc = 1;
    if (opts.limit != null) q.limit = opts.limit;
    if (opts.offset != null) q.offset = opts.offset;
    return q;
  }
  list(projectId, app, model, query = {}) {
    return this.c.proxy('api_manager', { path: `/api/v1/data/${encodeURIComponent(app)}/${encodeURIComponent(model)}`, projectId, query: this.queryOpts(query) });
  }
  query(projectId, app, model, opts = {}) {
    return this.list(projectId, app, model, opts);
  }
  listNested(projectId, app, parent, parentId, child, query = {}) {
    return this.c.proxy('api_manager', {
      path: `/api/v1/data/${encodeURIComponent(app)}/${encodeURIComponent(parent)}/${encodeURIComponent(parentId)}/${encodeURIComponent(child)}`,
      projectId,
      query: this.queryOpts(query),
    });
  }
  createNested(projectId, app, parent, parentId, child, body) {
    return this.c.proxy('api_manager', {
      method: 'POST',
      path: `/api/v1/data/${encodeURIComponent(app)}/${encodeURIComponent(parent)}/${encodeURIComponent(parentId)}/${encodeURIComponent(child)}`,
      projectId,
      body: { project_id: projectId, ...body },
    });
  }
  create(projectId, app, model, body) {
    return this.c.proxy('api_manager', { method: 'POST', path: `/api/v1/data/${encodeURIComponent(app)}/${encodeURIComponent(model)}`, projectId, body: { project_id: projectId, ...body } });
  }
  get(projectId, app, model, id, query = {}) {
    return this.c.proxy('api_manager', { path: `/api/v1/data/${encodeURIComponent(app)}/${encodeURIComponent(model)}/${encodeURIComponent(id)}`, projectId, query: this.queryOpts(query) });
  }
  update(projectId, app, model, id, body) {
    return this.c.proxy('api_manager', { method: 'PATCH', path: `/api/v1/data/${encodeURIComponent(app)}/${encodeURIComponent(model)}/${encodeURIComponent(id)}`, projectId, body });
  }
  remove(projectId, app, model, id) {
    return this.c.proxy('api_manager', { method: 'DELETE', path: `/api/v1/data/${encodeURIComponent(app)}/${encodeURIComponent(model)}/${encodeURIComponent(id)}`, projectId });
  }
  scale(projectId, name, desired) {
    return this.c.proxy('api_manager', { method: 'POST', path: `/api/v1/data-apis/${encodeURIComponent(name)}/scale`, projectId, body: { desired } });
  }
  evaluateAutoscaling(projectId, name, body = {}) {
    return this.c.proxy('api_manager', { method: 'POST', path: `/api/v1/data-apis/${encodeURIComponent(name)}/autoscaling/evaluate`, projectId, body });
  }
}

class StacksApi {
  constructor(client) { this.c = client; }
  apply(projectId) {
    return this.c.post(`/api/projects/${encodeURIComponent(projectId)}/stack/apply`);
  }
  get(projectId) {
    return this.c.get(`/api/projects/${encodeURIComponent(projectId)}/stack`);
  }
  put(projectId, body) {
    return this.c.request('PUT', `/api/projects/${encodeURIComponent(projectId)}/stack`, { body });
  }
  record(projectId, body) {
    return this.c.request('POST', `/api/projects/${encodeURIComponent(projectId)}/stack/record`, { body });
  }
}

class ThinProxyApi {
  constructor(client, serviceName) { this.c = client; this.serviceName = serviceName; }
  proxy(opts) { return this.c.proxy(this.serviceName, opts); }
}

class CacheApi {
  constructor(client) { this.c = client; }
  get(projectId, key) {
    return this.c.proxy('db_manager', { path: `/api/v1/cache/${encodeURIComponent(key)}`, projectId });
  }
  set(projectId, key, value) {
    return this.c.proxy('db_manager', {
      method: 'PUT',
      path: `/api/v1/cache/${encodeURIComponent(key)}`,
      projectId,
      body: { value },
    });
  }
}

class SearchApi {
  constructor(client) { this.c = client; }
  query(projectId, body) {
    return this.c.proxy('search_manager', { method: 'POST', path: '/api/v1/query', projectId, body: { project_id: projectId, ...body } });
  }
}

class QueryApi {
  constructor(client) { this.c = client; }
  sql(projectId, body) {
    return this.c.proxy('query_manager', { method: 'POST', path: '/api/v1/sql', projectId, body: { project_id: projectId, ...body } });
  }
}

class IotApi {
  constructor(client) { this.c = client; }
  publish(projectId, body) {
    return this.c.proxy('iot_manager', { method: 'POST', path: '/api/v1/publish', projectId, body: { project_id: projectId, ...body } });
  }
}

class PushApi {
  constructor(client) { this.c = client; }
  send(projectId, body) {
    return this.c.proxy('push_manager', { method: 'POST', path: '/api/v1/try', projectId, body: { project_id: projectId, ...body } });
  }
}

/** notify_manager — unified email/sms/slack/push facade. */
class NotifyApi {
  constructor(client) { this.c = client; }
  providers(projectId) {
    return this.c.proxy('notify_manager', { path: '/api/v1/providers', projectId });
  }
  list(projectId, query = {}) {
    return this.c.proxy('notify_manager', { path: '/api/v1/messages', projectId, query });
  }
  create(projectId, body) {
    return this.c.proxy('notify_manager', {
      method: 'POST',
      path: '/api/v1/messages',
      projectId,
      body: { project_id: projectId, ...body },
    });
  }
  get(projectId, id) {
    return this.c.proxy('notify_manager', {
      path: `/api/v1/messages/${encodeURIComponent(id)}`,
      projectId,
    });
  }
  update(projectId, id, body) {
    return this.c.proxy('notify_manager', {
      method: 'PATCH',
      path: `/api/v1/messages/${encodeURIComponent(id)}`,
      projectId,
      body: { project_id: projectId, ...body },
    });
  }
  remove(projectId, id) {
    return this.c.proxy('notify_manager', {
      method: 'DELETE',
      path: `/api/v1/messages/${encodeURIComponent(id)}`,
      projectId,
    });
  }
  send(projectId, id, body = {}) {
    return this.c.proxy('notify_manager', {
      method: 'POST',
      path: `/api/v1/messages/${encodeURIComponent(id)}/send`,
      projectId,
      body: { project_id: projectId, ...body },
    });
  }
  test(projectId, body = {}) {
    return this.c.proxy('notify_manager', {
      method: 'POST',
      path: '/api/v1/test',
      projectId,
      body: { project_id: projectId, ...body },
    });
  }
}

class ConfigApi {
  constructor(client) { this.c = client; }
  get(projectId, query) {
    return this.c.proxy('config_manager', { path: '/api/v1/namespaces', projectId, query });
  }
  evaluate(projectId, body) {
    return this.c.proxy('config_manager', { method: 'POST', path: '/api/v1/evaluate', projectId, body: { project_id: projectId, ...body } });
  }
}

class BackupApi {
  constructor(client) { this.c = client; }
  list(projectId) {
    return this.c.proxy('backup_manager', { path: '/api/v1/vaults', projectId });
  }
  run(projectId, body) {
    return this.c.proxy('backup_manager', {
      method: 'POST',
      path: '/api/v1/jobs',
      projectId,
      body: { project_id: projectId, ...body },
    });
  }
  jobs(projectId) {
    return this.c.proxy('backup_manager', { path: '/api/v1/jobs', projectId });
  }
  get(projectId, jobId) {
    return this.c.proxy('backup_manager', { path: `/api/v1/jobs/${encodeURIComponent(jobId)}`, projectId });
  }
  restore(projectId, jobId, dest) {
    return this.c.proxy('backup_manager', {
      method: 'POST',
      path: `/api/v1/jobs/${encodeURIComponent(jobId)}/restore`,
      projectId,
      body: { project_id: projectId, dest },
    });
  }
}

class IacApi {
  constructor(client) { this.c = client; }
  status(projectId) { return this.c.request('GET', `/api/projects/${projectId}/iac/status`); }
  hookup(projectId, body) { return this.c.request('POST', `/api/projects/${projectId}/iac/hookup`, { body }); }
  // Per-project infra-as-code file (devices, services, resources).
  export(projectId, { commit } = {}) {
    return this.c.request('GET', `/api/projects/${projectId}/infra/export${commit === false ? '?commit=0' : ''}`);
  }
  // System-tier infra-as-code file (system/infra.json).
  system() { return this.c.request('GET', '/api/system/infra/export'); }
  // Device-aware apply: enable the file's services on their pinned devices,
  // bake the resolved devices back into the stack, provision resources.
  applyFile(projectId, body = {}) { return this.c.request('POST', `/api/projects/${projectId}/infra/apply`, { body }); }
  // Down: detach services (soft) or also delete resources (hard).
  down(projectId, body = {}) { return this.c.request('POST', `/api/projects/${projectId}/infra/down`, { body }); }
  // Import an infra file as a brand-new project (hooked up + applied).
  import(body) { return this.c.request('POST', '/api/system/infra/import', { body }); }
  // Current infra file (from the stack) + fleet devices + hookup state.
  current(projectId) { return this.c.request('GET', `/api/projects/${projectId}/infra`); }
  // Save an infra file into the stack (single writer; commits infra.json).
  saveFile(projectId, file) { return this.c.request('PUT', `/api/projects/${projectId}/infra`, { body: { file } }); }
  // Stack revision history.
  revisions(projectId) { return this.c.request('GET', `/api/projects/${projectId}/stack/revisions`); }
  // Roll back to the previous revision, or to a specific one via { revision }.
  rollback(projectId, body = {}) { return this.c.request('POST', `/api/projects/${projectId}/stack/rollback`, { body }); }
  apply(projectId) { return this.c.request('POST', `/api/projects/${projectId}/stack/apply`); }
  put(projectId, body) { return this.c.request('PUT', `/api/projects/${projectId}/stack`, { body }); }
}

class EdgeApi {
  constructor(client) { this.c = client; }
  status(projectId) { return this.c.request('GET', `/api/projects/${projectId}/edge/status`); }
  hookup(projectId) { return this.c.request('POST', `/api/projects/${projectId}/edge/hookup`, { body: {} }); }
  importTunnels(projectId) { return this.c.request('POST', `/api/projects/${projectId}/edge/import-tunnels`, { body: {} }); }
}

class VpcApi {
  constructor(client) { this.c = client; }
  list() { return this.c.request('GET', '/api/workers/vpcs'); }
  status() { return this.c.request('GET', '/api/workers/vpcs'); }
  move(workerId, vpcId) { return this.c.request('PATCH', `/api/workers/${workerId}/vpc`, { body: { vpc_id: vpcId } }); }
}

class SetupApi {
  constructor(client) { this.c = client; }
  graph() { return this.c.request('GET', '/api/setup/graph'); }
  status(projectId) { return this.c.request('GET', `/api/setup/status?project_id=${encodeURIComponent(projectId)}`); }
  enable(projectId, service) {
    return this.c.request('POST', '/api/setup/enable', { body: { project_id: projectId, service } });
  }
}

class SystemsApi {
  constructor(client) { this.c = client; }
  check(workerId) { return this.c.request('POST', `/api/workers/${workerId}/host/check`); }
  update(workerId, { target } = {}) {
    return this.c.request('POST', `/api/workers/${workerId}/host/update`, { body: { target } });
  }
}

class GraphqlApi {
  constructor(client) { this.c = client; }
  execute(projectId, body) {
    return this.c.proxy('graphql_manager', {
      method: 'POST',
      path: '/api/v1/execute',
      projectId,
      body: { project_id: projectId, ...body },
    });
  }
}

class IamApi {
  constructor(client) { this.c = client; }
  evaluate(body) {
    return this.c.post('/api/iam/evaluate', body);
  }
}

module.exports = { AerekosClient, AerekosError, MANAGERS };
