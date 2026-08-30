/**
 * Lightweight in-memory rate limiter for Express (no extra dependencies).
 */

function clientIp(req) {
  return (
    req.ip
    || req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || 'unknown'
  );
}

/**
 * @param {{ windowMs?: number, max?: number, keyFn?: (req) => string, message?: string }} opts
 */
function createRateLimiter(opts = {}) {
  const windowMs = opts.windowMs ?? 60_000;
  const max = opts.max ?? 30;
  const keyFn = opts.keyFn || clientIp;
  const message = opts.message || 'too many requests';
  const buckets = new Map();

  return (req, res, next) => {
    if (process.env.NODE_ENV === 'test' || process.env.DISABLE_RATE_LIMIT === 'true') {
      return next();
    }
    const key = keyFn(req);
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || now >= bucket.reset) {
      bucket = { count: 0, reset: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      res.set('Retry-After', String(Math.ceil((bucket.reset - now) / 1000)));
      return res.status(429).json({
        error: { message, status: 429, code: 'RateLimited' },
      });
    }
    return next();
  };
}

module.exports = { createRateLimiter, clientIp };
