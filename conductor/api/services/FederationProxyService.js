'use strict';

const FederationGrantService = require('./FederationGrantService');
const { verifyGrant } = require('../utils/peerGrant');
const { FederationGrant } = require('../models');

async function resolveAttach(attachId) {
  const row = await FederationGrantService.getAttach(attachId);
  if (!row) {
    const err = new Error('attach not found');
    err.status = 404;
    throw err;
  }
  return row;
}

/**
 * Forward a request to the home conductor for an attached project.
 * Always uses home base_url; jobs stay on home (ADR 001).
 */
async function proxyToHome(attachId, { method = 'GET', path = '', headers = {}, body } = {}) {
  const attach = await resolveAttach(attachId);
  const peer = await FederationGrantService.findPeer(attach.home_peer_id);
  if (!peer) {
    const err = new Error('home peer not trusted');
    err.status = 400;
    throw err;
  }
  try {
    verifyGrant(peer.public_key, attach.grant_token);
  } catch (err) {
    await FederationGrantService.getAttach(attachId);
    try {
      const { ProjectFederationAttach } = require('../models');
      await ProjectFederationAttach.update(attach.id, {
        status: 'disconnected',
        last_error: err.message || 'grant invalid',
      });
    } catch (_) { /* ignore */ }
    throw err;
  }

  // Revocation check when we are the home (loopback) or have mirrored grant.
  try {
    const grants = await FederationGrant.findAll({ where: { jti: String(attach.grant_jti) } });
    if (grants[0] && grants[0].status === 'revoked') {
      const err = new Error('grant revoked');
      err.status = 410;
      throw err;
    }
  } catch (err) {
    if (err.status) throw err;
  }

  const base = String(attach.home_base_url || peer.base_url || '').replace(/\/$/, '');
  if (!base) {
    const err = new Error('home base_url missing');
    err.status = 400;
    throw err;
  }
  const rel = path.startsWith('/') ? path : `/${path}`;
  const url = `${base}${rel}`;
  const hdrs = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Federation-Grant': attach.grant_token,
    'X-Federation-Peer': attach.home_peer_id,
    'X-Project-Id': attach.home_project_id,
    ...(headers || {}),
  };
  const init = { method: String(method || 'GET').toUpperCase(), headers: hdrs };
  if (body !== undefined && init.method !== 'GET' && init.method !== 'HEAD') {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, init);
  } catch (err) {
    const { ProjectFederationAttach } = require('../models');
    await ProjectFederationAttach.update(attach.id, {
      status: 'disconnected',
      last_error: err.message || 'home unreachable',
    });
    const e = new Error(`home unreachable: ${err.message}`);
    e.status = 502;
    throw e;
  }

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = { raw: text }; }

  const { ProjectFederationAttach } = require('../models');
  if (res.ok) {
    await ProjectFederationAttach.update(attach.id, { status: 'active', last_error: '' });
  } else if (res.status >= 500) {
    await ProjectFederationAttach.update(attach.id, {
      status: 'degraded',
      last_error: `home ${res.status}`,
    });
  }

  return {
    status: res.status,
    ok: res.ok,
    data,
    attach_id: attach.id,
    home_project_id: attach.home_project_id,
  };
}

/** Convenience: GET home project details */
async function proxyGetProject(attachId) {
  const attach = await resolveAttach(attachId);
  return proxyToHome(attachId, {
    method: 'GET',
    path: `/api/projects/${attach.home_project_id}`,
  });
}

module.exports = {
  proxyToHome,
  proxyGetProject,
  resolveAttach,
};
