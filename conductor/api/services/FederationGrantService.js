'use strict';

const { ConductorPeer, FederationGrant, ProjectFederationAttach } = require('../models');
const PeerIdentityService = require('./PeerIdentityService');
const { signGrant, verifyGrant, decodeGrant } = require('../utils/peerGrant');
const { normalizeRole } = require('../utils/projectRoles');

const MATURITY = 'preview';

function publicGrant(row) {
  return {
    id: row.id,
    jti: row.jti,
    home_peer_id: row.home_peer_id,
    project_id: row.project_id,
    role: normalizeRole(row.role, 'member'),
    status: row.status || 'active',
    expires_at: row.expires_at,
    created_by: row.created_by || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function publicPeer(row) {
  return {
    id: row.id,
    peer_id: row.peer_id,
    public_key: row.public_key,
    base_url: row.base_url,
    label: row.label || '',
    status: row.status || 'trusted',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function publicAttach(row) {
  return {
    id: row.id,
    home_peer_id: row.home_peer_id,
    home_project_id: row.home_project_id,
    home_base_url: row.home_base_url,
    role: normalizeRole(row.role, 'member'),
    status: row.status || 'connecting',
    label: row.label || '',
    last_error: row.last_error || null,
    attached_by: row.attached_by || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function registerPeer(card = {}) {
  if (!card.peer_id || !card.public_key) {
    const err = new Error('peer_id and public_key required');
    err.status = 400;
    throw err;
  }
  const existing = await ConductorPeer.findAll({ where: { peer_id: String(card.peer_id) } });
  const fields = {
    peer_id: String(card.peer_id),
    public_key: String(card.public_key),
    base_url: String(card.base_url || '').replace(/\/$/, ''),
    label: String(card.label || ''),
    status: String(card.status || 'trusted'),
  };
  if (existing[0]) {
    const updated = await ConductorPeer.update(existing[0].id, fields);
    return publicPeer(updated || { ...existing[0], ...fields });
  }
  const row = await ConductorPeer.create(fields);
  return publicPeer(row);
}

async function listPeers() {
  const rows = await ConductorPeer.findAll({});
  return rows.map(publicPeer);
}

async function mintGrant(projectId, { role, ttl_ms } = {}, actorId) {
  const home = PeerIdentityService.getPeerCard();
  const ttl = Number(ttl_ms) > 0 ? Number(ttl_ms) : 7 * 24 * 60 * 60 * 1000;
  const exp = Math.floor((Date.now() + ttl) / 1000);
  const signed = signGrant(PeerIdentityService.getPrivateKeyPem(), {
    home_peer_id: home.peer_id,
    project_id: String(projectId),
    role: normalizeRole(role, 'member'),
    exp,
    sub: actorId ? String(actorId) : undefined,
  });
  const expires_at = new Date(signed.payload.exp * 1000).toISOString();
  const row = await FederationGrant.create({
    token: signed.token,
    jti: signed.jti,
    home_peer_id: home.peer_id,
    project_id: String(projectId),
    role: normalizeRole(role, 'member'),
    status: 'active',
    expires_at,
    created_by: actorId ? String(actorId) : '',
  });
  return {
    grant: publicGrant(row),
    token: signed.token,
    peer: home,
    maturity: MATURITY,
  };
}

async function findPeer(peerId) {
  const rows = await ConductorPeer.findAll({ where: { peer_id: String(peerId) } });
  return rows[0] || null;
}

async function attachGrant(token, { label } = {}, actorId) {
  if (!token) {
    const err = new Error('grant token required');
    err.status = 400;
    throw err;
  }
  const decoded = decodeGrant(token);
  const homePeerId = decoded.payload.home_peer_id;
  let peer = await findPeer(homePeerId);
  if (!peer) {
    const err = new Error('home peer not trusted — register peer card first');
    err.status = 400;
    err.code = 'PEER_NOT_TRUSTED';
    throw err;
  }
  const payload = verifyGrant(peer.public_key, token);
  const grants = await FederationGrant.findAll({ where: { jti: String(payload.jti) } }).catch(() => []);
  // Home may store the grant; remote may not. Prefer payload.
  const existing = await ProjectFederationAttach.findAll({
    where: { home_peer_id: String(payload.home_peer_id), home_project_id: String(payload.project_id) },
  });
  const fields = {
    home_peer_id: String(payload.home_peer_id),
    home_project_id: String(payload.project_id),
    home_base_url: String(peer.base_url || '').replace(/\/$/, ''),
    grant_token: String(token),
    grant_jti: String(payload.jti),
    role: normalizeRole(payload.role, 'member'),
    status: 'connecting',
    label: label || peer.label || payload.project_id,
    last_error: '',
    attached_by: actorId ? String(actorId) : '',
  };
  let row;
  if (existing[0]) {
    row = await ProjectFederationAttach.update(existing[0].id, fields);
    row = row || { ...existing[0], ...fields };
  } else {
    row = await ProjectFederationAttach.create(fields);
  }
  // Mark local mirror of grant if we are also home (loopback smoke).
  if (grants[0] && grants[0].status !== 'active') {
    await FederationGrant.update(grants[0].id, { status: 'active' });
  }
  return { attach: publicAttach(row), maturity: MATURITY };
}

async function listAttaches() {
  const rows = await ProjectFederationAttach.findAll({});
  return rows.map(publicAttach);
}

async function detach(attachId) {
  const rows = await ProjectFederationAttach.findAll({ where: { id: String(attachId) } });
  const row = rows[0];
  if (!row) {
    const err = new Error('attach not found');
    err.status = 404;
    throw err;
  }
  await ProjectFederationAttach.update(row.id, { status: 'disconnected' });
  try {
    const grants = await FederationGrant.findAll({ where: { jti: String(row.grant_jti) } });
    if (grants[0]) await FederationGrant.update(grants[0].id, { status: 'revoked' });
  } catch (_) { /* ignore */ }
  await ProjectFederationAttach.delete(row.id);
  return { detached: true, id: String(attachId) };
}

async function getAttach(attachId) {
  const rows = await ProjectFederationAttach.findAll({ where: { id: String(attachId) } });
  return rows[0] || null;
}

async function revokeGrant(projectId, jti) {
  const rows = await FederationGrant.findAll({ where: { project_id: String(projectId), jti: String(jti) } });
  const row = rows[0];
  if (!row) {
    const err = new Error('grant not found');
    err.status = 404;
    throw err;
  }
  const updated = await FederationGrant.update(row.id, { status: 'revoked' });
  return publicGrant(updated || { ...row, status: 'revoked' });
}

async function listGrants(projectId) {
  const rows = await FederationGrant.findAll({ where: { project_id: String(projectId) } });
  return rows.map(publicGrant);
}

module.exports = {
  MATURITY,
  registerPeer,
  listPeers,
  mintGrant,
  attachGrant,
  listAttaches,
  detach,
  getAttach,
  revokeGrant,
  listGrants,
  publicGrant,
  publicPeer,
  publicAttach,
  findPeer,
};
