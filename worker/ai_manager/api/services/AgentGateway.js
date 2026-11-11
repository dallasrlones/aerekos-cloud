'use strict';

/**
 * Priority LLM gateway — P0–P5 class + lane + aging + reserved user capacity.
 * Higher class preempts scheduling of lower; soft finish of in-flight atomics.
 */

const LANES = ['user', 'manager', 'plan', 'review', 'execute', 'reflect', 'safety', 'idle', 'train', 'compact'];

/** Lower number = higher priority (legacy lane order). */
const LANE_PRIORITY = {
  user: 0, manager: 1, plan: 2, review: 2, safety: 3, execute: 4, reflect: 5, idle: 6, train: 7, compact: 8,
};

/** Design ladder: P0 emergency … P5 speculative. */
const CLASS_PRIORITY = {
  0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5,
};

const LANE_TO_CLASS = {
  user: 1,
  manager: 2,
  plan: 2,
  review: 2, // higher-model PR approve — above coding execute
  safety: 0,
  execute: 3,
  reflect: 3,
  idle: 4,
  train: 4,
  compact: 5,
};

const AGING_MS = 30_000;
const AGING_BOOST = 0.5;

function isForeground(lane) {
  return ['user', 'manager', 'plan', 'review', 'safety', 'execute', 'reflect'].includes(lane);
}

function scoreJob(job, now = Date.now()) {
  const cls = Number(job.priorityClass != null ? job.priorityClass : (LANE_TO_CLASS[job.lane] ?? 3));
  const lane = LANE_PRIORITY[job.lane] ?? 8;
  const taskBoost = Number(job.taskPriority || 0);
  const ageBoost = Math.min(3, Math.floor((now - job.enqueuedAt) / AGING_MS) * AGING_BOOST);
  // Lower score wins
  return (CLASS_PRIORITY[cls] ?? cls) * 100 + lane * 10 - taskBoost - ageBoost;
}

function createGateway({
  maxConcurrent = 1,
  minIntervalMs = 0,
  reservedUserSlots = 1,
} = {}) {
  let nextId = 1;
  const waiting = [];
  const inFlight = new Set();
  let lastBackgroundStart = 0;
  const inflightMeta = [];
  let userReserved = Math.max(0, Number(reservedUserSlots) || 0);

  function peekNext() {
    const now = Date.now();
    const slotsLeft = maxConcurrent - inFlight.size;
    if (slotsLeft <= 0) return null;

    const userWaiting = waiting.filter((j) => j.lane === 'user' || j.priorityClass === 0 || j.priorityClass === 1);
    // Hold reserved slots for user even before enqueue when concurrency allows it.
    // If reserved == maxConcurrent (e.g. 1/1), still run non-user when no user is waiting
    // so single-slot gateways are not deadlocked.
    const nonUserInFlight = [...inFlight].filter((j) => j.lane !== 'user' && (j.priorityClass == null || j.priorityClass > 1)).length;
    const maxNonUser = Math.max(0, maxConcurrent - userReserved);
    const sorted = [...waiting].sort((a, b) => {
      const sd = scoreJob(a, now) - scoreJob(b, now);
      if (sd !== 0) return sd;
      return a.enqueuedAt - b.enqueuedAt;
    });

    for (const job of sorted) {
      const isUserish = job.lane === 'user' || job.priorityClass <= 1;
      if (!isUserish && userReserved > 0 && nonUserInFlight >= maxNonUser) {
        if (userWaiting.length > 0) continue;
        if (maxNonUser > 0) continue; // keep a free slot for future user chat
        // maxNonUser === 0: allow non-user so reserved==max does not starve workers
      }
      return job;
    }
    return null;
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
        id: job.id,
        lane: job.lane,
        priority_class: job.priorityClass,
        agent_id: job.agentId,
        started_at: Date.now(),
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

  function enqueue(lane, fn, {
    agentId, timeoutMs, priorityClass, taskPriority,
  } = {}) {
    const use = LANES.includes(lane) ? lane : 'execute';
    const cls = priorityClass != null
      ? Number(priorityClass)
      : (LANE_TO_CLASS[use] ?? 3);
    return new Promise((resolve, reject) => {
      const abort = new AbortController();
      const job = {
        id: nextId++,
        lane: use,
        priorityClass: cls,
        taskPriority: Number(taskPriority) || 0,
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
    const now = Date.now();
    return {
      max_concurrent: maxConcurrent,
      reserved_user_slots: userReserved,
      in_flight: inflightMeta.slice(),
      queued: [...waiting].sort((a, b) => scoreJob(a, now) - scoreJob(b, now)).map((j) => ({
        id: j.id,
        lane: j.lane,
        priority_class: j.priorityClass,
        task_priority: j.taskPriority,
        agent_id: j.agentId,
        wait_ms: now - j.enqueuedAt,
        score: scoreJob(j, now),
      })),
    };
  }

  function configure({
    maxConcurrent: mc, minIntervalMs: mi, reservedUserSlots: ru,
  } = {}) {
    if (mc != null) maxConcurrent = Math.max(1, Number(mc) || 1);
    if (mi != null) minIntervalMs = Math.max(0, Number(mi) || 0);
    if (ru != null) userReserved = Math.max(0, Number(ru) || 0);
  }

  function preemptUser() {
    return waiting.filter((j) => j.lane === 'user').length;
  }

  return {
    enqueue, snapshot, configure, preemptUser, LANES, scoreJob,
  };
}

const gateways = new Map();

function gatewayFor(projectId, settings = {}) {
  const key = String(projectId || 'default');
  if (!gateways.has(key)) {
    gateways.set(key, createGateway({
      maxConcurrent: Number(settings.llm_max_concurrent || 1) || 1,
      minIntervalMs: Number(settings.lane_min_interval_ms || 0) || 0,
      reservedUserSlots: Number(settings.reserved_user_slots != null ? settings.reserved_user_slots : 1),
    }));
  } else if (
    settings.llm_max_concurrent
    || settings.lane_min_interval_ms
    || settings.reserved_user_slots != null
  ) {
    gateways.get(key).configure({
      maxConcurrent: settings.llm_max_concurrent,
      minIntervalMs: settings.lane_min_interval_ms,
      reservedUserSlots: settings.reserved_user_slots,
    });
  }
  return gateways.get(key);
}

module.exports = {
  createGateway,
  gatewayFor,
  LANES,
  PRIORITY: LANE_PRIORITY,
  LANE_PRIORITY,
  LANE_TO_CLASS,
  CLASS_PRIORITY,
  scoreJob,
};
