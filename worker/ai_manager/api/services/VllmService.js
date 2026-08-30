const axios = require('axios');

/**
 * VllmService — proxies vLLM's OpenAI-compatible API (/v1/*).
 * External mode only in v1; vLLM runs in its own compose service on the GPU host.
 */
class VllmService {
  constructor(env = process.env) {
    this.cfg = VllmService.resolveConfig(env);
    this.http = axios.create({ baseURL: this.cfg.baseUrl, timeout: this.cfg.requestTimeoutMs });
    if (this.cfg.apiKey) {
      this.http.defaults.headers.common.Authorization = `Bearer ${this.cfg.apiKey}`;
    }
  }

  static resolveConfig(env) {
    const baseUrl = (env.VLLM_HOST || 'http://host.docker.internal:8000').trim().replace(/\/$/, '');
    return {
      mode: 'external',
      baseUrl,
      defaultModel: (env.VLLM_DEFAULT_MODEL || '').trim(),
      apiKey: (env.VLLM_API_KEY || '').trim(),
      requestTimeoutMs: parseInt(env.VLLM_REQUEST_TIMEOUT_MS || '1800000', 10),
    };
  }

  get mode() { return this.cfg.mode; }
  get baseUrl() { return this.cfg.baseUrl; }
  get supportsModelManagement() { return false; }

  /** Fail fast — do not wait 120s on every list/chat when the GPU process is down. */
  async ensureRunning() {
    try {
      return await this.health();
    } catch (e) {
      const err = new Error(`vLLM backend not ready at ${this.cfg.baseUrl}: ${e.message}`);
      err.status = 503;
      throw err;
    }
  }

  async waitReady(timeoutMs = 120000) {
    const deadline = Date.now() + timeoutMs;
    let lastErr;
    while (Date.now() < deadline) {
      try {
        return await this.health();
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    const err = new Error(`vLLM backend not ready at ${this.cfg.baseUrl}: ${lastErr?.message || 'timeout'}`);
    err.status = 503;
    throw err;
  }

  async health() {
    try {
      const { data } = await this.http.get('/health', { timeout: 5000, validateStatus: () => true });
      if (data && (data.status === 'ok' || data === 'ok')) return data;
    } catch (_) { /* fall through to /v1/models */ }
    const { data } = await this.http.get('/v1/models', { timeout: 8000 });
    return data;
  }

  async status() {
    const base = { mode: this.cfg.mode, base_url: this.cfg.baseUrl, provider: 'vllm' };
    try {
      await this.health();
      let models = [];
      try { models = await this.listModels(); } catch (_) {}
      return {
        ...base,
        reachable: true,
        model_count: models.length,
        default_model: this.cfg.defaultModel || models[0]?.name || null,
      };
    } catch (e) {
      return { ...base, reachable: false, error: e.message };
    }
  }

  async listModels() {
    const { data } = await this.http.get('/v1/models');
    const raw = data.data || data.models || [];
    return raw.map((m) => ({
      name: m.id || m.name,
      model: m.id || m.name,
      details: {
        family: m.owned_by || 'vllm',
        parameter_size: m.parameter_size || '',
      },
    }));
  }

  /** Strip Ollama/icarus-only fields; map OpenAI chat response to Ollama shape. */
  _toOpenAiChatBody(body) {
    const {
      model,
      messages,
      temperature,
      max_tokens,
      top_p,
      top_k,
      stop,
      stream,
      frequency_penalty,
      presence_penalty,
      response_format,
      seed,
      tools,
      tool_choice,
      user,
      options,
    } = body || {};

    const opts = options && typeof options === 'object' ? options : {};
    const out = {
      model: model || this.cfg.defaultModel,
      messages,
      stream: stream === true,
      // Qwen3.6 defaults to thinking; coach JSON needs direct output.
      chat_template_kwargs: { enable_thinking: false },
    };
    if (temperature !== undefined) out.temperature = temperature;
    else if (opts.temperature !== undefined) out.temperature = opts.temperature;
    if (max_tokens !== undefined) out.max_tokens = max_tokens;
    else if (opts.num_predict !== undefined) out.max_tokens = opts.num_predict;
    if (top_p !== undefined) out.top_p = top_p;
    else if (opts.top_p !== undefined) out.top_p = opts.top_p;
    if (top_k !== undefined) out.top_k = top_k;
    else if (opts.top_k !== undefined) out.top_k = opts.top_k;
    if (stop !== undefined) out.stop = stop;
    if (frequency_penalty !== undefined) out.frequency_penalty = frequency_penalty;
    if (presence_penalty !== undefined) out.presence_penalty = presence_penalty;
    if (response_format !== undefined) out.response_format = response_format;
    if (seed !== undefined) out.seed = seed;
    if (tools !== undefined) out.tools = tools;
    if (tool_choice !== undefined) out.tool_choice = tool_choice;
    if (user !== undefined) out.user = user;
    return out;
  }

  _messageText(msg) {
    if (!msg) return '';
    const content = msg.content;
    if (typeof content === 'string' && content.trim()) return content;
    return '';
  }

  _toOllamaChatResponse(openAi, requestedModel) {
    const choice = (openAi.choices || [])[0] || {};
    const msg = choice.message || {};
    return {
      model: openAi.model || requestedModel,
      message: {
        role: msg.role || 'assistant',
        content: this._messageText(msg),
      },
      done: choice.finish_reason === 'stop' || choice.finish_reason == null,
      provider: 'vllm',
      usage: openAi.usage,
    };
  }

  async chat(body) {
    const req = this._toOpenAiChatBody(body);
    if (!req.model) {
      const err = new Error('model is required (or set VLLM_DEFAULT_MODEL)');
      err.status = 400;
      throw err;
    }
    const { data } = await this.http.post('/v1/chat/completions', req);
    return this._toOllamaChatResponse(data, req.model);
  }

  async generate(body) {
    const { model, prompt, system } = body || {};
    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });
    const res = await this.chat({ ...body, model, messages });
    return {
      model: res.model,
      response: res.message?.content ?? '',
      done: res.done,
      provider: 'vllm',
    };
  }

  unsupported(op) {
    const err = new Error(
      `${op} is not supported on vLLM. Update the endpoint's model / serving options, or restart vLLM on the GPU host.`,
    );
    err.status = 409;
    err.code = 'not_supported_for_vllm';
    throw err;
  }

  async pullModel() { this.unsupported('Pull'); }
  async deleteModel() { this.unsupported('Delete'); }

  async showModel(name) {
    const models = await this.listModels();
    const found = models.find((m) => m.name === name || m.model === name);
    if (!found) {
      const err = new Error(`model not found: ${name}`);
      err.status = 404;
      throw err;
    }
    return found;
  }
}

module.exports = { VllmService };
