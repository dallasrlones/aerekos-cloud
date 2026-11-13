'use strict';

/**
 * Idempotency-Key middleware (in-memory store for tests/dev; swap store in prod).
 * @see docs/plans/enterprise_standards.md — uniform POST retries
 */

const TWENTY_FOUR_H_MS = 24 * 60 * 60 * 1000;

function readIdempotencyKey(req) {
  const h = req.headers || {};
  const fromHeader = h['idempotency-key'] || h['x-idempotency-key'] || null;
  const fromBody = req.body && req.body.idempotency_key;
  const raw = fromHeader || fromBody;
  return raw ? String(raw).trim() : '';
}

/**
 * @param {{ ttlMs?: number, now?: () => number }} [opts]
 */
function createMemoryIdempotencyStore(opts = {}) {
  const ttlMs = opts.ttlMs ?? TWENTY_FOUR_H_MS;
  const now = opts.now || (() => Date.now());
  /** @type {Map<string, { status: number, body: unknown, expires: number }>} */
  const entries = new Map();

  function purgeExpired() {
    const t = now();
    for (const [k, v] of entries) {
      if (v.expires <= t) entries.delete(k);
    }
  }

  return {
    get(key) {
      purgeExpired();
      const hit = entries.get(key);
      if (!hit || hit.expires <= now()) {
        if (hit) entries.delete(key);
        return null;
      }
      return { status: hit.status, body: hit.body };
    },
    set(key, { status, body }) {
      entries.set(key, { status, body, expires: now() + ttlMs });
    },
    delete(key) {
      entries.delete(key);
    },
    clear() {
      entries.clear();
    },
    size() {
      purgeExpired();
      return entries.size;
    },
  };
}

/**
 * @param {{ store?: ReturnType<typeof createMemoryIdempotencyStore>, methods?: string[], scopeKey?: (req) => string }} opts
 */
function createIdempotencyMiddleware(opts = {}) {
  const store = opts.store || createMemoryIdempotencyStore();
  const methods = new Set(
    (opts.methods || ['POST', 'PUT', 'PATCH']).map((m) => String(m).toUpperCase()),
  );
  const scopeKey =
    opts.scopeKey ||
    ((req) => `${req.method}:${req.baseUrl || ''}${req.path || req.url}`);

  return (req, res, next) => {
    if (process.env.DISABLE_IDEMPOTENCY === 'true') return next();
    if (!methods.has(req.method)) return next();

    const key = readIdempotencyKey(req);
    if (!key) return next();

    const composite = `${scopeKey(req)}::${key}`;
    const prior = store.get(composite);
    if (prior) {
      res.setHeader('X-Idempotency-Replayed', 'true');
      return res.status(prior.status).json(prior.body);
    }

    req.idempotencyKey = key;
    req.idempotencyComposite = composite;

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300 && req.idempotencyComposite) {
        try {
          store.set(req.idempotencyComposite, { status: res.statusCode, body });
        } catch {
          /* ignore cache write errors */
        }
      }
      return originalJson(body);
    };

    return next();
  };
}

module.exports = {
  TWENTY_FOUR_H_MS,
  readIdempotencyKey,
  createMemoryIdempotencyStore,
  createIdempotencyMiddleware,
};
