const axios = require('axios');

/**
 * Shared HTTP proxy helpers for TTS/STT upstreams (icarus voice contract).
 * Upstreams: tts-cache (8015), kokoro (8013), xtts (8002), stt-service (8001).
 */

function cfg(env = process.env) {
  return {
    ttsBackend: (env.TTS_BACKEND || 'cache').toLowerCase(), // cache | kokoro | xtts
    ttsCacheUrl: (env.TTS_CACHE_URL || 'http://host.docker.internal:8015').replace(/\/$/, ''),
    ttsKokoroUrl: (env.TTS_KOKORO_URL || 'http://host.docker.internal:8013').replace(/\/$/, ''),
    ttsXttsUrl: (env.TTS_XTTS_URL || 'http://host.docker.internal:8002').replace(/\/$/, ''),
    ttsUrl: (env.TTS_URL || '').replace(/\/$/, ''), // explicit override
    ttsVoice: env.TTS_VOICE || 'af_heart',
    ttsLanguage: env.TTS_LANGUAGE || 'en',
    ttsAuth: env.TTS_AUTH || '',
    sttUrl: (env.STT_URL || 'http://host.docker.internal:8001').replace(/\/$/, ''),
    sttAuth: env.STT_AUTH || '',
    timeoutMs: parseInt(env.VOICE_TIMEOUT_MS || '120000', 10),
  };
}

function resolveTtsUrl(c) {
  if (c.ttsUrl) return c.ttsUrl;
  if (c.ttsBackend === 'kokoro') return c.ttsKokoroUrl;
  if (c.ttsBackend === 'xtts') return c.ttsXttsUrl;
  return c.ttsCacheUrl; // default: concatenative cache (stored words + live misses)
}

function authHeader(token) {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

async function probeHealth(url, token) {
  try {
    const { data } = await axios.get(`${url}/health`, {
      timeout: 8000,
      headers: authHeader(token),
      validateStatus: () => true,
    });
    return { reachable: true, ...data };
  } catch (e) {
    return { reachable: false, error: e.message };
  }
}

class VoiceProxyService {
  constructor(env = process.env) {
    this.c = cfg(env);
  }

  /** Build a proxy from a resolved integration record (local TTS/STT upstream). */
  static forIntegration(integration) {
    const cap = integration.capability;
    const ptype = integration.provider_type || integration.provider;
    const endpoint = (integration.endpoint || '').replace(/\/$/, '');
    const opts = integration.options || {};
    const env = { ...process.env };

    if (cap === 'stt' || ptype === 'whisper') {
      env.STT_URL = endpoint;
      if (integration.apiKey) env.STT_AUTH = integration.apiKey;
      return new VoiceProxyService(env);
    }

    env.TTS_BACKEND = ptype;
    env.TTS_URL = endpoint;
    if (ptype === 'cache') env.TTS_CACHE_URL = endpoint;
    if (ptype === 'kokoro') env.TTS_KOKORO_URL = endpoint;
    if (ptype === 'xtts') env.TTS_XTTS_URL = endpoint;
    if (integration.model) env.TTS_VOICE = integration.model;
    if (opts.language) env.TTS_LANGUAGE = opts.language;
    if (integration.apiKey) env.TTS_AUTH = integration.apiKey;
    return new VoiceProxyService(env);
  }

  ttsTarget() {
    return resolveTtsUrl(this.c);
  }

  async ttsStatus() {
    const url = this.ttsTarget();
    const health = await probeHealth(url, this.c.ttsAuth);
    return {
      backend: this.c.ttsBackend,
      url,
      voice: this.c.ttsVoice,
      language: this.c.ttsLanguage,
      ...health,
    };
  }

  async sttStatus() {
    const health = await probeHealth(this.c.sttUrl, this.c.sttAuth);
    return { url: this.c.sttUrl, ...health };
  }

  /**
   * POST /synthesize — icarus contract. Returns { buffer, contentType, headers }.
   */
  async synthesize(body) {
    const { text, voice, language, speed } = body || {};
    if (!text || !String(text).trim()) {
      const e = new Error('text is required'); e.status = 400; throw e;
    }
    const url = this.ttsTarget();
    const res = await axios.post(`${url}/synthesize`, {
      text: String(text).slice(0, 4900),
      voice: voice || this.c.ttsVoice,
      language: language || this.c.ttsLanguage,
      speed: typeof speed === 'number' ? speed : 1.0,
    }, {
      timeout: this.c.timeoutMs,
      headers: { 'Content-Type': 'application/json', ...authHeader(this.c.ttsAuth) },
      responseType: 'arraybuffer',
      validateStatus: () => true,
    });
    if (res.status >= 400) {
      const detail = Buffer.from(res.data || '').toString('utf8').slice(0, 300);
      const e = new Error(`tts upstream ${res.status}: ${detail}`); e.status = 502; throw e;
    }
    return {
      buffer: Buffer.from(res.data),
      contentType: res.headers['content-type'] || 'audio/wav',
      voice: res.headers['x-voice'],
      language: res.headers['x-language'],
      cache: res.headers['x-cache'],
    };
  }

  /** GET /stats on tts-cache (only when backend is cache or URL is cache). */
  async cacheStats() {
    const url = this.c.ttsCacheUrl;
    try {
      const { data } = await axios.get(`${url}/stats`, { timeout: 5000, validateStatus: () => true });
      return data;
    } catch (e) {
      return { error: e.message };
    }
  }

  /**
   * POST /transcribe — multipart upload (icarus contract).
   */
  async transcribe(audioBuffer, opts = {}) {
    if (!audioBuffer || !audioBuffer.length) {
      const e = new Error('audio is required'); e.status = 400; throw e;
    }
    const FormData = require('form-data');
    const form = new FormData();
    const filename = opts.filename || guessFilename(opts.contentType);
    form.append('file', audioBuffer, { filename, contentType: opts.contentType || 'application/octet-stream' });
    if (opts.language) form.append('language', opts.language);
    if (opts.task) form.append('task', opts.task);

    const res = await axios.post(`${this.c.sttUrl}/transcribe`, form, {
      timeout: this.c.timeoutMs,
      headers: { ...form.getHeaders(), ...authHeader(this.c.sttAuth) },
      maxBodyLength: Infinity,
      validateStatus: () => true,
    });
    if (res.status >= 400) {
      const e = new Error(`stt upstream ${res.status}`); e.status = 502; throw e;
    }
    if (!res.data || typeof res.data.text !== 'string') {
      const e = new Error('stt upstream returned no text'); e.status = 502; throw e;
    }
    return res.data;
  }
}

function guessFilename(contentType = '') {
  const ct = contentType.toLowerCase();
  if (ct.includes('webm')) return 'rec.webm';
  if (ct.includes('ogg')) return 'rec.ogg';
  if (ct.includes('mp4') || ct.includes('m4a')) return 'rec.m4a';
  if (ct.includes('mp3') || ct.includes('mpeg')) return 'rec.mp3';
  if (ct.includes('wav')) return 'rec.wav';
  return 'rec.bin';
}

module.exports = { VoiceProxyService, cfg, resolveTtsUrl };
