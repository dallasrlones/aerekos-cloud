const axios = require('axios');

/**
 * OllamaService — manages an Ollama backend and proxies its REST API.
 *
 * Two backends, chosen per-device via env (see resolveConfig):
 *   - external: talk to an already-running Ollama (e.g. the native, GPU-accelerated
 *     daemon on a Jetson Orin). Set OLLAMA_HOST=http://<host>:11434.
 *   - container: launch and supervise a dedicated `ollama/ollama` container via the
 *     Docker socket. On hosts whose default Docker runtime is `nvidia` (Jetson) the
 *     container gets the GPU automatically; elsewhere we attach a GPU DeviceRequest
 *     when OLLAMA_GPU is enabled and fall back to CPU if that fails.
 *
 * Network reachability (container mode): ai_manager reaches the ollama container
 * over the published host port via OLLAMA_HOST or host.docker.internal.
 */
class OllamaService {
  constructor(env = process.env) {
    this.cfg = OllamaService.resolveConfig(env);
    this.http = axios.create({ baseURL: this.cfg.baseUrl, timeout: this.cfg.requestTimeoutMs });
    this._docker = null;
    this._ensuring = null;
  }

  static resolveConfig(env) {
    const explicitHost = (env.OLLAMA_HOST || '').trim().replace(/\/$/, '');
    const mode = (env.OLLAMA_MODE || (explicitHost ? 'external' : 'container')).toLowerCase();
    const port = parseInt(env.OLLAMA_PORT || '11434', 10);
    const containerName = env.OLLAMA_CONTAINER_NAME || 'aerekos-ollama';
    // Container mode reaches ollama by container name on the shared Docker network
    // (ai_manager runs in the same network). host.docker.internal is the fallback.
    const containerHost = explicitHost || `http://${containerName}:11434`;
    return {
      mode,
      baseUrl: mode === 'external' ? (explicitHost || `http://127.0.0.1:${port}`) : containerHost,
      port,
      image: env.OLLAMA_IMAGE || 'ollama/ollama',
      containerName,
      network: env.OLLAMA_NETWORK || 'aerekos',
      // Host path where models live (shared with native Ollama). When set, the
      // launched container bind-mounts this instead of a named Docker volume.
      modelsDir: (env.OLLAMA_MODELS_DIR || '').trim(),
      volume: env.OLLAMA_VOLUME || 'aerekos-ollama-models',
      gpu: (env.OLLAMA_GPU || 'auto').toLowerCase(), // auto | true | false
      requestTimeoutMs: parseInt(env.OLLAMA_REQUEST_TIMEOUT_MS || '1800000', 10),
      dockerSocket: env.DOCKER_SOCKET || '/var/run/docker.sock',
    };
  }

  _useHostGatewayFallback() {
    this.cfg.baseUrl = `http://host.docker.internal:${this.cfg.port}`;
    this.http = axios.create({ baseURL: this.cfg.baseUrl, timeout: this.cfg.requestTimeoutMs });
  }

  get mode() { return this.cfg.mode; }
  get baseUrl() { return this.cfg.baseUrl; }
  get supportsModelManagement() { return true; }

  docker() {
    if (!this._docker) {
      const Docker = require('dockerode');
      this._docker = new Docker({ socketPath: this.cfg.dockerSocket });
    }
    return this._docker;
  }

  /**
   * Ensure the backend is reachable. In container mode this will create/start the
   * ollama container on first call. Returns once /api/version responds (or throws).
   */
  async ensureRunning() {
    if (this.cfg.mode === 'container') {
      if (!this._ensuring) {
        this._ensuring = this._ensureContainer().catch((e) => { this._ensuring = null; throw e; });
      }
      await this._ensuring;
    }
    return this.waitReady();
  }

  async _ensureContainer() {
    const docker = this.docker();
    const existing = docker.getContainer(this.cfg.containerName);
    let info = null;
    try { info = await existing.inspect(); } catch (_) { info = null; }

    if (info) {
      if (!info.State.Running) {
        await existing.start();
      }
      return;
    }

    // Pull image if not present locally.
    await this._ensureImage();

    const modelBind = this.cfg.modelsDir
      ? `${this.cfg.modelsDir}:/root/.ollama`
      : `${this.cfg.volume}:/root/.ollama`;
    const hostConfig = {
      RestartPolicy: { Name: 'unless-stopped' },
      Binds: [modelBind],
      PortBindings: { '11434/tcp': [{ HostPort: String(this.cfg.port) }] },
    };
    // Attach GPU explicitly only when requested; on nvidia-default-runtime hosts the
    // GPU is already present without a DeviceRequest.
    if (this.cfg.gpu === 'true') {
      hostConfig.DeviceRequests = [{ Driver: 'nvidia', Count: -1, Capabilities: [['gpu']] }];
    }

    const create = async (withGpu, withNetwork) => {
      const hc = { ...hostConfig };
      if (!withGpu) delete hc.DeviceRequests;
      const spec = {
        Image: this.cfg.image,
        name: this.cfg.containerName,
        ExposedPorts: { '11434/tcp': {} },
        Labels: { 'aerekos.managed': 'true', 'aerekos.service': 'ai_manager', 'aerekos.component': 'ollama' },
        HostConfig: hc,
      };
      if (withNetwork) {
        spec.HostConfig.NetworkMode = this.cfg.network;
        spec.NetworkingConfig = { EndpointsConfig: { [this.cfg.network]: { Aliases: [this.cfg.containerName] } } };
      }
      const container = await docker.createContainer(spec);
      await container.start();
      return container;
    };

    const attempt = async (withGpu) => {
      try {
        await create(withGpu, true);
      } catch (netErr) {
        // Shared network may not exist (e.g. ai_manager running standalone) — retry
        // without it and reach ollama via the host gateway instead.
        try { await docker.getContainer(this.cfg.containerName).remove({ force: true }); } catch (_) {}
        await create(withGpu, false);
        this._useHostGatewayFallback();
      }
    };

    try {
      await attempt(this.cfg.gpu === 'true');
    } catch (err) {
      // GPU DeviceRequest can fail on hosts without the nvidia toolkit — retry CPU.
      if (this.cfg.gpu === 'true') {
        try { await docker.getContainer(this.cfg.containerName).remove({ force: true }); } catch (_) {}
        await attempt(false);
      } else {
        throw err;
      }
    }
  }

  async _ensureImage() {
    const docker = this.docker();
    try {
      await docker.getImage(this.cfg.image).inspect();
      return;
    } catch (_) { /* needs pull */ }
    await new Promise((resolve, reject) => {
      docker.pull(this.cfg.image, (err, stream) => {
        if (err) return reject(err);
        docker.modem.followProgress(stream, (doneErr) => (doneErr ? reject(doneErr) : resolve()));
      });
    });
  }

  async waitReady(timeoutMs = 60000) {
    const deadline = Date.now() + timeoutMs;
    let lastErr;
    while (Date.now() < deadline) {
      try {
        const v = await this.version();
        return v;
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    const err = new Error(`Ollama backend not ready at ${this.cfg.baseUrl}: ${lastErr?.message || 'timeout'}`);
    err.status = 503;
    throw err;
  }

  async version() {
    const { data } = await this.http.get('/api/version', { timeout: 5000 });
    return data;
  }

  /** Backend status without throwing — used by GET /llm/status. */
  async status() {
    const base = { mode: this.cfg.mode, base_url: this.cfg.baseUrl, gpu: this.cfg.gpu };
    try {
      const version = await this.version();
      let models = [];
      try { models = await this.listModels(); } catch (_) {}
      return { ...base, reachable: true, version: version.version, model_count: models.length };
    } catch (e) {
      return { ...base, reachable: false, error: e.message };
    }
  }

  async listModels() {
    const { data } = await this.http.get('/api/tags');
    return data.models || [];
  }

  async showModel(name) {
    const { data } = await this.http.post('/api/show', { name });
    return data;
  }

  async deleteModel(name) {
    await this.http.delete('/api/delete', { data: { name } });
    return { deleted: true, name };
  }

  /**
   * Pull a model. Ollama streams NDJSON progress; onProgress(obj) is called per line.
   * Resolves when the stream completes.
   */
  async pullModel(name, onProgress) {
    const res = await this.http.post('/api/pull', { name, stream: true }, { responseType: 'stream' });
    return this._consumeNdjson(res.data, onProgress);
  }

  /** Non-streaming generate. */
  async generate(body) {
    const { data } = await this.http.post('/api/generate', { ...body, stream: false });
    return data;
  }

  /** Non-streaming chat. */
  async chat(body) {
    const payload = {
      model: body.model,
      messages: body.messages,
      stream: false,
    };
    if (body.options) payload.options = body.options;
    if (body.format) payload.format = body.format;
    if (body.keep_alive != null) payload.keep_alive = body.keep_alive;
    if (body.tools) payload.tools = body.tools;
    if (body.tool_choice) payload.tool_choice = body.tool_choice;
    const { data } = await this.http.post('/api/chat', payload);
    return data;
  }

  /** Embeddings — POST /api/embed */
  async embed(body) {
    const { data } = await this.http.post('/api/embed', body);
    return data;
  }

  /** Streaming generate/chat: returns the raw NDJSON axios stream for piping. */
  async stream(endpoint, body) {
    const res = await this.http.post(`/api/${endpoint}`, { ...body, stream: true }, { responseType: 'stream' });
    return res.data;
  }

  async streamChat(body, { onDelta, abortSignal } = {}) {
    const payload = {
      model: body.model,
      messages: body.messages,
      stream: true,
    };
    if (body.options) payload.options = body.options;
    if (body.tools) payload.tools = body.tools;
    if (body.tool_choice) payload.tool_choice = body.tool_choice;
    const res = await this.http.post('/api/chat', payload, { responseType: 'stream', signal: abortSignal });
    let content = '';
    const last = await this._consumeNdjson(res.data, (obj) => {
      const delta = obj.message?.content || '';
      if (delta) {
        content += delta;
        if (onDelta) onDelta(delta);
      }
    });
    const done = last[last.length - 1] || { message: { role: 'assistant', content }, done: true };
    if (!done.message) done.message = { role: 'assistant', content };
    if (!done.message.content) done.message.content = content;
    const toolCalls = last.map((o) => o.message?.tool_calls).find((t) => Array.isArray(t) && t.length);
    if (toolCalls) done.message.tool_calls = toolCalls;
    return done;
  }

  _consumeNdjson(stream, onLine) {
    return new Promise((resolve, reject) => {
      let buf = '';
      const lines = [];
      stream.on('data', (chunk) => {
        buf += chunk.toString('utf8');
        let idx;
        while ((idx = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 1);
          if (!line) continue;
          try {
            const obj = JSON.parse(line);
            lines.push(obj);
            if (onLine) onLine(obj);
          } catch (_) { /* ignore partial/garbage */ }
        }
      });
      stream.on('end', () => {
        const last = buf.trim();
        if (last) {
          try { const obj = JSON.parse(last); lines.push(obj); if (onLine) onLine(obj); } catch (_) {}
        }
        resolve(lines);
      });
      stream.on('error', reject);
    });
  }
}

module.exports = { OllamaService };
