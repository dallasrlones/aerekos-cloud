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
      max_model_len: m.max_model_len,
      details: {
        family: m.owned_by || 'vllm',
        parameter_size: m.parameter_size || '',
      },
    }));
  }

  /**
   * Icarus (and other clients) still send stale HF ids (e.g. cyankiwi/…).
   * vLLM 404s those; remap to whatever is actually loaded.
   */
  static pickServedModel(requested, servedNames, defaultModel) {
    const names = (Array.isArray(servedNames) ? servedNames : []).map((n) => String(n || '').trim()).filter(Boolean);
    const want = String(requested || '').trim();
    const fallback = String(defaultModel || '').trim();
    if (want && names.includes(want)) return want;
    if (fallback && names.includes(fallback)) return fallback;
    if (names.length) return names[0];
    return want || fallback;
  }

  static estimatePromptTokens(messages) {
    const text = (Array.isArray(messages) ? messages : [])
      .map((m) => (typeof m?.content === 'string' ? m.content : JSON.stringify(m?.content || '')))
      .join('\n');
    return Math.ceil(text.length / 2.8);
  }

  static clampMaxTokens(requested, promptTokens, maxModelLen) {
    const cap = Number(maxModelLen) > 0 ? Number(maxModelLen) : 0;
    const want = Number(requested);
    const prompt = Math.max(0, Number(promptTokens) || 0);
    if (!cap) return Number.isFinite(want) && want > 0 ? want : undefined;
    const room = Math.max(8, cap - prompt - 24);
    if (!Number.isFinite(want) || want <= 0) return Math.min(256, room);
    return Math.min(want, room);
  }

  static fitMessages(messages, maxModelLen, requestedMaxTokens) {
    const cap = Number(maxModelLen) > 0 ? Number(maxModelLen) : 0;
    const msgs = (Array.isArray(messages) ? messages : []).map((m) => ({
      ...m,
      content: m?.content,
    }));
    if (!cap) return { messages: msgs, max_tokens: VllmService.clampMaxTokens(requestedMaxTokens, 0, 0) };
    const wantOut = Number(requestedMaxTokens) > 0 ? Number(requestedMaxTokens) : 256;
    const reserve = Math.min(wantOut, 256) + 32;
    const budget = Math.max(256, cap - reserve);
    let guard = 0;
    while (VllmService.estimatePromptTokens(msgs) > budget && guard < 40) {
      guard += 1;
      const sys = msgs.find((m) => m.role === 'system' && String(m.content || '').length > 400);
      if (sys) {
        const c = String(sys.content);
        sys.content = `${c.slice(0, Math.floor(c.length * 0.8))}\n[truncated]`;
        continue;
      }
      if (msgs.length > 3) {
        msgs.splice(1, 1);
        continue;
      }
      break;
    }
    const prompt = VllmService.estimatePromptTokens(msgs);
    return { messages: msgs, max_tokens: VllmService.clampMaxTokens(requestedMaxTokens, prompt, cap) };
  }

  async resolveServedModel(requested) {
    let names = [];
    try {
      names = (await this.listModels()).map((m) => m.name || m.model).filter(Boolean);
    } catch (_) { /* use default */ }
    return VllmService.pickServedModel(requested, names, this.cfg.defaultModel);
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
    const toolCalls = msg.tool_calls || [];
    return {
      model: openAi.model || requestedModel,
      message: {
        role: msg.role || 'assistant',
        content: this._messageText(msg),
        ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
      },
      done: choice.finish_reason === 'stop' || (!choice.finish_reason && !toolCalls.length),
      finish_reason: choice.finish_reason || (toolCalls.length ? 'tool_calls' : 'stop'),
      provider: 'vllm',
      usage: openAi.usage,
    };
  }

  async chat(body) {
    const req = this._toOpenAiChatBody(body);
    let served = [];
    try {
      served = await this.listModels();
    } catch (_) { /* remap/clamp with empty list */ }
    const names = served.map((m) => m.name || m.model).filter(Boolean);
    req.model = VllmService.pickServedModel(req.model, names, this.cfg.defaultModel);
    if (!req.model) {
      const err = new Error('model is required (or set VLLM_DEFAULT_MODEL)');
      err.status = 400;
      throw err;
    }
    const hit = served.find((m) => m.name === req.model || m.model === req.model) || served[0];
    const fitted = VllmService.fitMessages(req.messages, hit?.max_model_len, req.max_tokens);
    req.messages = fitted.messages;
    if (fitted.max_tokens) req.max_tokens = fitted.max_tokens;
    try {
      const { data } = await this.http.post('/v1/chat/completions', req);
      return this._toOllamaChatResponse(data, req.model);
    } catch (e) {
      const status = e.response?.status;
      const msg = e.response?.data?.error?.message || e.response?.data?.message || e.message;
      const over = status === 400 && /maximum context length/i.test(String(msg));
      if (over) {
        const tighter = VllmService.fitMessages(req.messages, Math.min(hit?.max_model_len || 4096, 2048), 128);
        req.messages = tighter.messages;
        req.max_tokens = tighter.max_tokens || 64;
        try {
          const { data } = await this.http.post('/v1/chat/completions', req);
          return this._toOllamaChatResponse(data, req.model);
        } catch (e2) {
          const err2 = new Error(e2.response?.data?.error?.message || e2.message);
          err2.status = e2.response?.status && e2.response.status >= 400 ? e2.response.status : 502;
          throw err2;
        }
      }
      const err = new Error(msg);
      err.status = status && status >= 400 ? status : 502;
      throw err;
    }
  }

  async streamChat(body, { onDelta, abortSignal } = {}) {
    const req = this._toOpenAiChatBody(body);
    let served = [];
    try { served = await this.listModels(); } catch (_) { /* */ }
    const names = served.map((m) => m.name || m.model).filter(Boolean);
    req.model = VllmService.pickServedModel(req.model, names, this.cfg.defaultModel);
    if (!req.model) {
      const err = new Error('model is required (or set VLLM_DEFAULT_MODEL)');
      err.status = 400;
      throw err;
    }
    const hit = served.find((m) => m.name === req.model || m.model === req.model) || served[0];
    const fitted = VllmService.fitMessages(req.messages, hit?.max_model_len, req.max_tokens);
    req.messages = fitted.messages;
    if (fitted.max_tokens) req.max_tokens = fitted.max_tokens;
    req.stream = true;
    const res = await this.http.post('/v1/chat/completions', req, {
      responseType: 'stream',
      signal: abortSignal,
    });
    let content = '';
    const toolCalls = [];
    let finish = 'stop';
    await new Promise((resolve, reject) => {
      let buf = '';
      res.data.on('data', (chunk) => {
        if (abortSignal?.aborted) {
          try { res.data.destroy(); } catch (_) { /* */ }
          return resolve();
        }
        buf += chunk.toString('utf8');
        const parts = buf.split('\n');
        buf = parts.pop() || '';
        for (const line of parts) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const obj = JSON.parse(payload);
            const choice = obj.choices?.[0] || {};
            if (choice.finish_reason) finish = choice.finish_reason;
            const delta = choice.delta || {};
            if (delta.content) {
              content += delta.content;
              if (onDelta) onDelta(delta.content);
            }
            for (const tc of delta.tool_calls || []) {
              const idx = Number(tc.index ?? toolCalls.length);
              if (!toolCalls[idx]) toolCalls[idx] = { id: tc.id || '', type: 'function', function: { name: '', arguments: '' } };
              if (tc.id) toolCalls[idx].id = tc.id;
              if (tc.function?.name) toolCalls[idx].function.name += tc.function.name;
              if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
            }
          } catch (_) { /* partial */ }
        }
      });
      res.data.on('end', resolve);
      res.data.on('error', reject);
    });
    const kept = toolCalls.filter(Boolean);
    return this._toOllamaChatResponse({
      id: 'stream',
      model: req.model,
      choices: [{
        message: { role: 'assistant', content, ...(kept.length ? { tool_calls: kept } : {}) },
        finish_reason: kept.length ? 'tool_calls' : finish,
      }],
    }, req.model);
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
