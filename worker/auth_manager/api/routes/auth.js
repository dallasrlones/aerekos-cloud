const express = require('express');
const TokenService = require('../services/TokenService');
const { createRateLimiter } = require('../../../shared/rateLimit');

const r = express.Router();

const tokenRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: 60,
  message: 'too many token requests',
});

// POST /api/v1/auth/token — client_credentials grant -> access token
// body: { client_id, client_secret, scope?, audience? }
r.post('/token', tokenRateLimit, async (req, res, next) => {
  try {
    const grant = req.body?.grant_type || 'client_credentials';
    if (grant !== 'client_credentials') {
      return res.status(400).json({ error: 'unsupported_grant_type' });
    }
    const out = await TokenService.issueClientToken(req.body || {});
    res.json(out);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

// POST /api/v1/auth/verify — verify a bearer token (body.token or Authorization header)
r.post('/verify', (req, res) => {
  const header = req.headers.authorization;
  const token = (req.body && req.body.token) || (header && header.startsWith('Bearer ') ? header.slice(7) : null);
  if (!token) return res.status(400).json({ active: false, error: 'token required' });
  try {
    const claims = TokenService.verify(token);
    res.json({ active: true, claims });
  } catch (e) {
    res.status(200).json({ active: false, error: e.message });
  }
});

// RFC 7662-style alias
r.post('/introspect', (req, res) => {
  const token = (req.body && req.body.token) || null;
  if (!token) return res.status(400).json({ active: false });
  try {
    const claims = TokenService.verify(token);
    res.json({ active: true, ...claims });
  } catch (_) {
    res.json({ active: false });
  }
});

module.exports = r;
