'use strict';

const express = require('express');
const authenticate = require('../middleware/auth');
const { requireProjectMember, requireProjectRole } = require('../middleware/requireProjectMember');
const { requireProjectCapability } = require('../middleware/requireProjectCapability');
const PeerIdentityService = require('../services/PeerIdentityService');
const FederationGrantService = require('../services/FederationGrantService');
const FederationProxyService = require('../services/FederationProxyService');
const FederationStatusService = require('../services/FederationStatusService');

const router = express.Router();

function handleErr(res, next, err) {
  if (err?.status) {
    return res.status(err.status).json({
      error: { message: err.message, code: err.code, status: err.status },
    });
  }
  return next(err);
}

/** GET /api/federation/peer — this conductor's peer card */
router.get('/peer', authenticate, (req, res) => {
  res.json({
    peer: PeerIdentityService.getPeerCard(),
    maturity: FederationGrantService.MATURITY,
  });
});

/** POST /api/federation/peers — trust a remote peer card */
router.post('/peers', authenticate, async (req, res, next) => {
  try {
    const peer = await FederationGrantService.registerPeer(req.body?.peer || req.body || {});
    res.status(201).json({ peer, maturity: FederationGrantService.MATURITY });
  } catch (err) {
    handleErr(res, next, err);
  }
});

/** GET /api/federation/peers */
router.get('/peers', authenticate, async (req, res, next) => {
  try {
    const peers = await FederationGrantService.listPeers();
    res.json({ peers, maturity: FederationGrantService.MATURITY });
  } catch (err) {
    handleErr(res, next, err);
  }
});

/** POST /api/federation/attach — accept a signed grant */
router.post('/attach', authenticate, async (req, res, next) => {
  try {
    const token = req.body?.token || req.body?.grant_token || req.body?.grant;
    const actorId = req.userId || req.user?.id;
    const result = await FederationGrantService.attachGrant(
      token,
      { label: req.body?.label },
      actorId,
    );
    // Probe once so UI gets a live status chip quickly.
    try {
      await FederationStatusService.statusForAttach(result.attach.id);
      const fresh = await FederationGrantService.getAttach(result.attach.id);
      if (fresh) result.attach = FederationGrantService.publicAttach(fresh);
    } catch (_) { /* keep connecting */ }
    res.status(201).json(result);
  } catch (err) {
    handleErr(res, next, err);
  }
});

/** GET /api/federation/attaches */
router.get('/attaches', authenticate, async (req, res, next) => {
  try {
    const attaches = await FederationGrantService.listAttaches();
    res.json({ attaches, maturity: FederationGrantService.MATURITY });
  } catch (err) {
    handleErr(res, next, err);
  }
});

/** DELETE /api/federation/attaches/:id */
router.delete('/attaches/:id', authenticate, async (req, res, next) => {
  try {
    const result = await FederationGrantService.detach(req.params.id);
    res.json(result);
  } catch (err) {
    handleErr(res, next, err);
  }
});

/** GET /api/federation/attaches/:id/status */
router.get('/attaches/:id/status', authenticate, async (req, res, next) => {
  try {
    const status = await FederationStatusService.statusForAttach(req.params.id);
    res.json(status);
  } catch (err) {
    handleErr(res, next, err);
  }
});

/** ALL /api/federation/attaches/:id/proxy?path=/api/projects/:id — forward to home */
router.all('/attaches/:id/proxy', authenticate, async (req, res, next) => {
  try {
    const path = req.query.path || req.body?.path || `/api/projects/${req.query.project_id || ''}`;
    if (!path || path === '/api/projects/') {
      return res.status(400).json({ error: { message: 'path query required', status: 400 } });
    }
    const result = await FederationProxyService.proxyToHome(req.params.id, {
      method: req.method,
      path: String(path),
      headers: {
        Authorization: req.headers.authorization || '',
      },
      body: ['GET', 'HEAD'].includes(String(req.method || 'GET').toUpperCase()) ? undefined : req.body,
    });
    res.status(result.status).json(result.data);
  } catch (err) {
    handleErr(res, next, err);
  }
});

/** GET /api/federation/attaches/:id/project — convenience home project read */
router.get('/attaches/:id/project', authenticate, async (req, res, next) => {
  try {
    const result = await FederationProxyService.proxyGetProject(req.params.id);
    res.status(result.status).json({
      ...result.data,
      federation: {
        attach_id: result.attach_id,
        home_project_id: result.home_project_id,
        maturity: FederationGrantService.MATURITY,
      },
    });
  } catch (err) {
    handleErr(res, next, err);
  }
});

/**
 * Mount helpers for project-scoped grant routes (also wired from project.js path).
 * POST /api/projects/:id/federation/grants
 */
async function mintProjectGrant(req, res, next) {
  try {
    const actorId = req.userId || req.user?.id;
    const result = await FederationGrantService.mintGrant(
      req.params.id,
      { role: req.body?.role, ttl_ms: req.body?.ttl_ms },
      actorId,
    );
    res.status(201).json(result);
  } catch (err) {
    handleErr(res, next, err);
  }
}

async function listProjectGrants(req, res, next) {
  try {
    const grants = await FederationGrantService.listGrants(req.params.id);
    res.json({ grants, maturity: FederationGrantService.MATURITY });
  } catch (err) {
    handleErr(res, next, err);
  }
}

module.exports = router;
module.exports.mintProjectGrant = mintProjectGrant;
module.exports.listProjectGrants = listProjectGrants;
module.exports.requireProjectMember = requireProjectMember;
module.exports.requireProjectRole = requireProjectRole;
module.exports.requireProjectCapability = requireProjectCapability;
