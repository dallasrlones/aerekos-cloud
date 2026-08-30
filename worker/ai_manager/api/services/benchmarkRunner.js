'use strict';

const { LlmBenchmarkService } = require('./LlmBenchmarkService');
const { defaultOllama } = require('./llmResolve');

const bench = new LlmBenchmarkService();
const STARTUP_DELAY_MS = parseInt(process.env.LLM_BENCH_STARTUP_DELAY_MS || '45000', 10);
const POLL_MS = parseInt(process.env.LLM_BENCH_POLL_MS || '900000', 10);
const ENABLED = process.env.LLM_BENCH_ENABLED !== 'false';

let pollTimer = null;

function kickPending(ollamaSvc = defaultOllama) {
  if (!ENABLED || process.env.NODE_ENV === 'test') return { started: false, reason: 'disabled' };
  return bench.schedulePending(ollamaSvc);
}

function kickModel(model, ollamaSvc = defaultOllama) {
  if (!ENABLED || process.env.NODE_ENV === 'test' || !model) return;
  bench.schedulePending(ollamaSvc, { models: [model] });
}

function startBenchmarkScheduler() {
  if (!ENABLED || process.env.NODE_ENV === 'test') return;

  setTimeout(() => {
    console.log('[ai_manager] benchmark: checking for unbenchmarked models (serial)…');
    const r = kickPending();
    if (r.started) {
      console.log(`[ai_manager] benchmark: queued (depth ${r.queue_depth})`);
    } else {
      console.log(`[ai_manager] benchmark: ${r.reason}`);
    }
  }, STARTUP_DELAY_MS);

  if (POLL_MS > 0) {
    pollTimer = setInterval(() => {
      kickPending();
    }, POLL_MS);
    if (pollTimer.unref) pollTimer.unref();
  }
}

function stopBenchmarkScheduler() {
  if (pollTimer) clearInterval(pollTimer);
}

module.exports = {
  bench,
  kickPending,
  kickModel,
  startBenchmarkScheduler,
  stopBenchmarkScheduler,
};
