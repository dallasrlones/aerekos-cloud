/**
 * Release server routes — the conductor's "own GitHub".
 *
 *   POST /api/releases?version=<v>&notes=<n>   publish a new release (admin)
 *                                              body = gzipped tarball of the repo
 *   GET  /api/releases                         list releases (admin)
 *   GET  /api/releases/latest                  latest release metadata (agent/admin)
 *   GET  /api/releases/check?hostname=&current= should-this-device-update? (agent/admin)
 *   GET  /api/releases/:version/bundle          download a release tarball (agent/admin)
 */
const express = require('express');
const router = express.Router();
const ReleaseService = require('../services/ReleaseService');
const UpdateService = require('../services/UpdateService');
const authenticate = require('../middleware/auth');
const agentAuth = require('../middleware/agentAuth');

function publishAuth(req, res, next) {
  const tok = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const allowed = [process.env.CONDUCTOR_TOKEN, process.env.SERVICE_TOKEN, process.env.INTERNAL_RELEASE_TOKEN].filter(Boolean);
  if (tok && allowed.includes(tok)) {
    req.user = { id: 'service', role: 'service' };
    return next();
  }
  return authenticate(req, res, next);
}

// Publish: accept the raw gzip body (any content-type) up to 200 MB.
router.post(
  '/',
  publishAuth,
  express.raw({ type: () => true, limit: '200mb' }),
  (req, res, next) => {
    try {
      const version = (req.query.version || '').trim();
      const notes = req.query.notes || '';
      if (!version) {
        return res.status(400).json({ error: { message: 'version query param is required', status: 400 } });
      }
      const entry = ReleaseService.publish(version, req.body, notes);
      res.status(201).json({ release: entry });
    } catch (error) {
      res.status(400).json({ error: { message: error.message, status: 400 } });
    }
  }
);

router.get('/', authenticate, (req, res) => {
  res.json({ releases: ReleaseService.list() });
});

router.get('/latest', agentAuth, (req, res) => {
  const latest = ReleaseService.getLatest();
  if (!latest) return res.json({ release: null });
  res.json({
    release: {
      version: latest.version,
      sha256: latest.sha256,
      size: latest.size,
      notes: latest.notes,
      created_at: latest.created_at,
      bundle: `/api/releases/${latest.version}/bundle`,
    },
  });
});

router.get('/check', agentAuth, (req, res) => {
  const hostname = (req.query.hostname || '').trim();
  const current = (req.query.current || '').trim();
  const decision = UpdateService.decide(hostname, current);
  res.json({
    ...decision,
    bundle: decision.version ? `/api/releases/${decision.version}/bundle` : null,
  });
});

router.get('/:version/bundle', agentAuth, (req, res) => {
  try {
    const p = ReleaseService.bundlePath(req.params.version);
    if (!p) return res.status(404).json({ error: { message: 'Release not found', status: 404 } });
    res.setHeader('Content-Type', 'application/gzip');
    res.download(p, `${req.params.version}.tar.gz`);
  } catch (error) {
    res.status(400).json({ error: { message: error.message, status: 400 } });
  }
});

module.exports = router;
