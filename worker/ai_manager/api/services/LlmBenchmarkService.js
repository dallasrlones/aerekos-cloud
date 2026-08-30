'use strict';

const { AiModelBenchmark } = require('../models');
const {
  chatModelFilter,
  parseParamB,
  scoreResponse,
} = require('./LlmBenchmarkScoring');

const DEFAULT_SUITE = process.env.LLM_BENCH_SUITE || 'json-commands-v1';
/** Bench uses keep_alive=0 so only one model sits in VRAM at a time. */
const BENCH_KEEP_ALIVE = process.env.LLM_BENCH_KEEP_ALIVE ?? '0';
const GAP_MS = parseInt(process.env.LLM_BENCH_GAP_MS || '500', 10);
const MAX_B = parseFloat(process.env.BENCH_MAX_B || '12');
const USER_MSG = process.env.LLM_BENCH_USER_MSG || 'Can we create a task to eat cake?';
const SYSTEM = process.env.LLM_BENCH_SYSTEM || `You are ICARUS — a personal productivity coach inside the user's private task/calendar app. NOT a therapist. NEVER refuse tasks. NEVER crisis hotlines or "as an AI".

RESPOND WITH ONLY valid JSON (no markdown fences):
{"reply":"short spoken line","expression":"happy","commands":[{"kind":"propose_create_task","payload":{"title":"Eat cake","status":"todo","priority":"medium"}}]}

When user asks to create a task, emit propose_create_task. Silly tasks like eat cake are fine.`;

const runState = {
  status: 'idle',
  endpoint: null,
  suite: DEFAULT_SUITE,
  total: 0,
  done: 0,
  current: null,
  started_at: null,
  updated_at: null,
  error: null,
  queued: 0,
  mode: 'serial',
};

/** One benchmark job at a time — never parallel on slow GPUs. */
let serialChain = Promise.resolve();
let queuedJobs = 0;

function endpointKey(svc) {
  return (svc?.baseUrl || svc?.cfg?.baseUrl || 'default').replace(/\/$/, '');
}

function boolStr(v) {
  return v ? 'true' : 'false';
}

class LlmBenchmarkService {
  get suite() {
    return DEFAULT_SUITE;
  }

  getRunState() {
    return { ...runState };
  }

  async listResults({ endpoint, suite = DEFAULT_SUITE, limit = 200 } = {}) {
    const where = { suite };
    if (endpoint) where.endpoint = endpoint;
    const rows = await AiModelBenchmark.findAll({ where });
    return rows
      .sort((a, b) => String(b.benchmarked_at || '').localeCompare(String(a.benchmarked_at || '')))
      .slice(0, limit)
      .map((r) => this._toPublic(r));
  }

  async getForModel(endpoint, model, suite = DEFAULT_SUITE) {
    const rows = await AiModelBenchmark.findAll({ where: { endpoint, model, suite } });
    const row = rows[0];
    return row ? this._toPublic(row) : null;
  }

  async listBenchmarkedModels(endpoint, suite = DEFAULT_SUITE) {
    const rows = await AiModelBenchmark.findAll({ where: { endpoint, suite } });
    return new Set(rows.map((r) => r.model));
  }

  async listPending(ollamaSvc, { suite = DEFAULT_SUITE, maxB = MAX_B } = {}) {
    const ep = endpointKey(ollamaSvc);
    const done = await this.listBenchmarkedModels(ep, suite);
    const models = await ollamaSvc.listModels();
    return models
      .filter((m) => m.name && chatModelFilter(m.name))
      .map((m) => ({
        name: m.name,
        parameter_size: m.details?.parameter_size || null,
        paramB: parseParamB(m.details?.parameter_size),
      }))
      .filter((m) => m.paramB <= maxB)
      .filter((m) => !done.has(m.name))
      .sort((a, b) => a.paramB - b.paramB || a.name.localeCompare(b.name));
  }

  async saveResult(endpoint, modelMeta, result, suite = DEFAULT_SUITE) {
    const existingRows = await AiModelBenchmark.findAll({
      where: { endpoint, model: modelMeta.name, suite },
    });
    const existing = existingRows[0];
    const payload = {
      endpoint,
      model: modelMeta.name,
      suite,
      parameter_size: modelMeta.parameter_size || modelMeta.param || null,
      pass: boolStr(result.pass),
      reason: result.reason || null,
      checks: JSON.stringify(result.checks || {}),
      wall_ms: result.wallMs != null ? String(result.wallMs) : null,
      warm_ms: result.warmMs != null ? String(result.warmMs) : null,
      load_ms: result.loadMs != null ? String(result.loadMs) : null,
      eval_ms: result.evalMs != null ? String(result.evalMs) : null,
      total_ms: result.totalMs != null ? String(result.totalMs) : null,
      reply_preview: result.replyPreview || null,
      benchmarked_at: new Date().toISOString(),
    };
    if (existing) {
      return AiModelBenchmark.update(existing.id, payload);
    }
    return AiModelBenchmark.create(payload);
  }

  async benchOne(ollamaSvc, modelMeta) {
    const messages = [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: USER_MSG },
    ];
    const model = modelMeta.name;
    const unload = { model, messages, keep_alive: BENCH_KEEP_ALIVE };

    // Warm load (still serial — one model in memory)
    const warm = await this._chat(ollamaSvc, unload);
    if (!warm.ok) {
      return {
        model,
        parameter_size: modelMeta.parameter_size,
        pass: false,
        reason: warm.error,
        warmMs: warm.wallMs,
      };
    }

    // Timed run; keep_alive=0 unloads model from VRAM before the next bench
    const run = await this._chat(ollamaSvc, unload);
    if (!run.ok) {
      await this._unloadModel(ollamaSvc, model);
      return {
        model,
        parameter_size: modelMeta.parameter_size,
        pass: false,
        reason: run.error,
        warmMs: warm.wallMs,
      };
    }

    await this._unloadModel(ollamaSvc, model);

    const scored = scoreResponse(run.content);
    return {
      model,
      parameter_size: modelMeta.parameter_size,
      pass: scored.pass,
      reason: scored.reason,
      checks: scored.checks,
      title: scored.title,
      warmMs: warm.wallMs,
      wallMs: run.wallMs,
      loadMs: run.loadMs,
      totalMs: run.totalMs,
      evalMs: run.evalMs,
      replyPreview: String(run.content).slice(0, 160).replace(/\s+/g, ' '),
    };
  }

  async _unloadModel(ollamaSvc, model) {
    try {
      await ollamaSvc.chat({
        model,
        messages: [{ role: 'user', content: '.' }],
        keep_alive: 0,
      });
    } catch (_) {
      /* best-effort unload */
    }
  }

  _gap() {
    if (GAP_MS <= 0) return Promise.resolve();
    return new Promise((r) => setTimeout(r, GAP_MS));
  }

  async _chat(ollamaSvc, body) {
    const t0 = Date.now();
    try {
      const data = await ollamaSvc.chat(body);
      const wallMs = Date.now() - t0;
      const content = data.message?.content || '';
      return {
        ok: true,
        wallMs,
        loadMs: Math.round((data.load_duration || 0) / 1e6),
        totalMs: Math.round((data.total_duration || 0) / 1e6),
        evalMs: Math.round((data.eval_duration || 0) / 1e6),
        content,
      };
    } catch (e) {
      return { ok: false, wallMs: Date.now() - t0, error: e.message || String(e) };
    }
  }

  /**
   * Queue a serial benchmark run — one model at a time, never parallel.
   * Returns immediately; work runs on a single background chain.
   */
  schedulePending(ollamaSvc, { models = null, force = false, suite = DEFAULT_SUITE, maxB = MAX_B } = {}) {
    queuedJobs += 1;
    runState.queued = queuedJobs;
    const queueDepth = queuedJobs;

    serialChain = serialChain
      .then(() => this._runSerial(ollamaSvc, { models, force, suite, maxB }))
      .catch((e) => {
        if (runState.status === 'running') {
          runState.status = 'error';
          runState.error = e.message;
        }
        console.error('[ai_manager] benchmark run failed:', e.message);
      })
      .finally(() => {
        queuedJobs = Math.max(0, queuedJobs - 1);
        runState.queued = queuedJobs;
      });

    return {
      started: true,
      queued: queueDepth > 1,
      queue_depth: queueDepth,
      mode: 'serial',
      run: this.getRunState(),
    };
  }

  async _runSerial(ollamaSvc, { models, force, suite, maxB }) {
    const ep = endpointKey(ollamaSvc);
    let todo;
    if (Array.isArray(models) && models.length > 0) {
      const done = force ? new Set() : await this.listBenchmarkedModels(ep, suite);
      todo = models
        .map((name) => ({ name, parameter_size: null, paramB: 999 }))
        .filter((m) => force || !done.has(m.name));
    } else {
      todo = await this.listPending(ollamaSvc, { suite, maxB });
    }

    if (todo.length === 0) {
      return { started: false, reason: 'nothing_pending', endpoint: ep, suite };
    }

    runState.status = 'running';
    runState.endpoint = ep;
    runState.suite = suite;
    runState.total = todo.length;
    runState.done = 0;
    runState.current = null;
    runState.started_at = new Date().toISOString();
    runState.updated_at = runState.started_at;
    runState.error = null;

    try {
      await ollamaSvc.ensureRunning();
      for (const m of todo) {
        runState.current = m.name;
        runState.updated_at = new Date().toISOString();
        let result;
        try {
          result = await this.benchOne(ollamaSvc, m);
        } catch (e) {
          result = { model: m.name, parameter_size: m.parameter_size, pass: false, reason: String(e) };
        }
        await this.saveResult(ep, m, result, suite);
        runState.done += 1;
        runState.updated_at = new Date().toISOString();
        console.log(`[ai_manager] bench ${m.name}: ${result.pass ? 'PASS' : 'FAIL'} ${result.reason} (${result.wallMs || '?'}ms)`);
        await this._gap();
      }
      runState.status = 'idle';
      runState.current = null;
      return { started: true, endpoint: ep, suite, pending: todo.length, run: this.getRunState() };
    } catch (e) {
      runState.status = 'error';
      runState.error = e.message;
      runState.updated_at = new Date().toISOString();
      console.error('[ai_manager] benchmark run failed:', e.message);
      throw e;
    }
  }

  enrichModels(models, benchmarksByName) {
    return models.map((m) => {
      const b = benchmarksByName.get(m.name);
      if (!b) return { ...m, benchmark: null };
      return {
        ...m,
        benchmark: {
          suite: b.suite,
          pass: b.pass === 'true' || b.pass === true,
          wall_ms: b.wall_ms ? parseInt(b.wall_ms, 10) : null,
          reason: b.reason,
          benchmarked_at: b.benchmarked_at,
        },
      };
    });
  }

  _toPublic(row) {
    let checks = {};
    try { checks = JSON.parse(row.checks || '{}'); } catch (_) {}
    return {
      id: row.id,
      endpoint: row.endpoint,
      model: row.model,
      suite: row.suite,
      parameter_size: row.parameter_size,
      pass: row.pass === 'true',
      reason: row.reason,
      checks,
      wall_ms: row.wall_ms ? parseInt(row.wall_ms, 10) : null,
      warm_ms: row.warm_ms ? parseInt(row.warm_ms, 10) : null,
      load_ms: row.load_ms ? parseInt(row.load_ms, 10) : null,
      eval_ms: row.eval_ms ? parseInt(row.eval_ms, 10) : null,
      total_ms: row.total_ms ? parseInt(row.total_ms, 10) : null,
      reply_preview: row.reply_preview,
      benchmarked_at: row.benchmarked_at,
    };
  }
}

module.exports = {
  LlmBenchmarkService,
  endpointKey,
  DEFAULT_SUITE,
};
