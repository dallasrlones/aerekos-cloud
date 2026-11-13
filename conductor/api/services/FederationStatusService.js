'use strict';

const FederationGrantService = require('./FederationGrantService');
const { verifyGrant } = require('../utils/peerGrant');
const { FederationGrant, ProjectFederationAttach } = require('../models');

async function probeHealth(baseUrl) {
  const url = `${String(baseUrl || '').replace(/\/$/, '')}/health`;
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 4000) : null;
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: ctrl?.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timer);
    return { ok: res.ok, status: res.status };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, error: err.message };
  }
}

/**
 * connecting | active | degraded | disconnected
 */
async function statusForAttach(attachId) {
  const attach = await FederationGrantService.getAttach(attachId);
  if (!attach) {
    const err = new Error('attach not found');
    err.status = 404;
    throw err;
  }

  const peer = await FederationGrantService.findPeer(attach.home_peer_id);
  if (!peer) {
    await ProjectFederationAttach.update(attach.id, {
      status: 'disconnected',
      last_error: 'peer not trusted',
    });
    return {
      attach_id: attach.id,
      status: 'disconnected',
      reason: 'peer_not_trusted',
      maturity: FederationGrantService.MATURITY,
    };
  }

  try {
    verifyGrant(peer.public_key, attach.grant_token);
  } catch (err) {
    await ProjectFederationAttach.update(attach.id, {
      status: 'disconnected',
      last_error: err.message || 'grant invalid',
    });
    return {
      attach_id: attach.id,
      status: 'disconnected',
      reason: err.message || 'grant_invalid',
      maturity: FederationGrantService.MATURITY,
    };
  }

  try {
    const grants = await FederationGrant.findAll({ where: { jti: String(attach.grant_jti) } });
    if (grants[0] && grants[0].status === 'revoked') {
      await ProjectFederationAttach.update(attach.id, {
        status: 'disconnected',
        last_error: 'grant revoked',
      });
      return {
        attach_id: attach.id,
        status: 'disconnected',
        reason: 'grant_revoked',
        maturity: FederationGrantService.MATURITY,
      };
    }
  } catch (_) { /* remote may not have grant row */ }

  const base = attach.home_base_url || peer.base_url;
  if (attach.status === 'connecting') {
    // Still connecting until first successful probe
  }

  const health = await probeHealth(base);
  let status = 'active';
  let reason = 'ok';
  if (!health.ok) {
    status = 'disconnected';
    reason = health.error || `health_${health.status || 'fail'}`;
  } else if (attach.last_error) {
    status = 'degraded';
    reason = attach.last_error;
  }

  await ProjectFederationAttach.update(attach.id, {
    status,
    last_error: status === 'active' ? '' : (attach.last_error || reason),
  });

  return {
    attach_id: attach.id,
    status,
    reason,
    home_peer_id: attach.home_peer_id,
    home_project_id: attach.home_project_id,
    home_base_url: base,
    maturity: FederationGrantService.MATURITY,
  };
}

module.exports = {
  statusForAttach,
  probeHealth,
};
