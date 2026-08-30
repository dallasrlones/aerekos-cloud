'use strict';

const buckets = new Map();

function clientKey(req) {
  const fwd = req.headers['x-forwarded-for'];
  const ip = (typeof fwd === 'string' ? fwd.split(',')[0] : '') || req.ip || req.connection?.remoteAddress || 'unknown';
  const user = String(req.body?.username || '').trim().toLowerCase();
  return `${ip}:${user}`;
}

function loginRateLimit(req, res, next) {
  if (process.env.NODE_ENV === 'test' && process.env.LOGIN_RATE_FORCE !== '1') {
    return next();
  }
  const windowMs = Number(process.env.LOGIN_RATE_WINDOW_MS || 15 * 60 * 1000);
  const maxAttempts = Number(process.env.LOGIN_RATE_MAX || 10);
  const key = clientKey(req);
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now - bucket.start > windowMs) {
    bucket = { start: now, count: 0 };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > maxAttempts) {
    const retry = Math.ceil((bucket.start + windowMs - now) / 1000);
    res.set('Retry-After', String(Math.max(retry, 1)));
    return res.status(429).json({
      error: {
        message: 'Too many login attempts. Try again later.',
        status: 429,
        code: 'LOGIN_RATE_LIMITED',
      },
    });
  }
  return next();
}

function _resetForTests() {
  buckets.clear();
}

module.exports = { loginRateLimit, _resetForTests };
