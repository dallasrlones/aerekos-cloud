'use strict';

/**
 * Serial LLM gateway. User lane jumps the queue. Callers enqueue — they do not
 * Promise.all the intelligence client. Default max concurrent = 1.
 */

const LANES = ['user', 'manager', 'plan', 'execute', 'reflect', 'safety', 'idle', 'train', 'compact'];
const PRIORITY = {
  user: 0, manager: 1, plan: 2, safety: 3, execute: 4, reflect: 5, idle: 6, train: 7, compact: 8,
};

function isForeground(lane) {
  return lane === 'user' || lane === 'manager' || lane === 'plan' || lane === 'safety' || lane === 'execute' || lane === 'reflect';
}

function createGateway({ maxConcurrent = 1, minIntervalMs = 0 } = {}) {
  let nextId = 1;
  const waiting = [];
  const inFlight = new Set();
  let lastBackgroundStart = 0;
  const inflightMeta = [];

  function peekNext() {
    return [...waiting].sort((a, b) => {
      const pd = PRIORITY[a.lane] - PRIORITY[b.lane];
      if (pd !== 0) return pd;
      return a.enqueuedAt - b.enqueuedAt;
    })[0];
  }

  function pump() {
    while (inFlight.size < maxConcurrent) {
      const job = peekNext();
      if (!job) return;
      if (!isForeground(job.lane) && minIntervalMs > 0) {
        const wait = minIntervalMs - (Date.now() - lastBackgroundStart);
        if (wait > 0) {
          setTimeout(pump, wait);
          return;
        }
      }
      waiting.splice(waiting.indexOf(job), 1);
      inFlight.add(job);
      if (!isForeground(job.lane)) lastBackgroundStart = Date.now();
      inflightMeta.push({
        id: job.id, lane: job.lane, agent_id: job.agentId, started_at: Date.now(),
      });
      Promise.resolve()
        .then(() => job.fn(job.abort.signal))
        .then(job.resolve, job.reject)
        .finally(() => {
          inFlight.delete(job);
          const i = inflightMeta.findIndex((m) => m.id === job.id);
          if (i >= 0) inflightMeta.splice(i, 1);
          pump();
        });
    }
  }

  function enqueue(lane, fn, { agentId, timeoutMs } = {}) {
    const use = LANES.includes(lane) ? lane : 'execute';
    return new Promise((resolve, reject) => {
      const abort = new AbortController();
      const job = {
        id: nextId++,
        lane: use,
        fn,
        resolve,
        reject,
        abort,
        agentId: agentId || '',
        enqueuedAt: Date.now(),
      };
      waiting.push(job);
      if (timeoutMs && timeoutMs > 0) {
        setTimeout(() => {
          if (waiting.includes(job)) {
            waiting.splice(waiting.indexOf(job), 1);
            reject(Object.assign(new Error('gateway queue timeout'), { status: 504 }));
          }
        }, timeoutMs);
      }
      pump();
    });
  }

  function snapshot() {
    return {
      max_concurrent: maxConcurrent,
      in_flight: inflightMeta.slice(),
      queued: [...waiting].sort((a, b) => {
        const pd = PRIORITY[a.lane] - PRIORITY[b.lane];
        if (pd !== 0) return pd;
        return a.enqueuedAt - b.enqueuedAt;
      }).map((j) => ({
        id: j.id, lane: j.lane, agent_id: j.agentId, wait_ms: Date.now() - j.enqueuedAt,
      })),
    };
  }

  function configure({ maxConcurrent: mc, minIntervalMs: mi } = {}) {
    if (mc != null) maxConcurrent = Math.max(1, Number(mc) || 1);
    if (mi != null) minIntervalMs = Math.max(0, Number(mi) || 0);
  }

  function preemptUser() {
    return waiting.filter((j) => j.lane === 'user').length;
  }

  return { enqueue, snapshot, configure, preemptUser, LANES };
}

const gateways = new Map();

function gatewayFor(projectId, settings = {}) {
  const key = String(projectId || 'default');
  if (!gateways.has(key)) {
    gateways.set(key, createGateway({
      maxConcurrent: Number(settings.llm_max_concurrent || 1) || 1,
      minIntervalMs: Number(settings.lane_min_interval_ms || 0) || 0,
    }));
  } else if (settings.llm_max_concurrent || settings.lane_min_interval_ms) {
    gateways.get(key).configure({
      maxConcurrent: settings.llm_max_concurrent,
      minIntervalMs: settings.lane_min_interval_ms,
    });
  }
  return gateways.get(key);
}

module.exports = { createGateway, gatewayFor, LANES, PRIORITY };
