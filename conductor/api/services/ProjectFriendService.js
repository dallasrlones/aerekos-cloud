'use strict';

const crypto = require('crypto');
const { ProjectMember, ProjectInvite, User } = require('../models');
const { MEMBER_ROLES, normalizeRole, roleRank } = require('../utils/projectRoles');

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function publicMember(row, user) {
  return {
    id: row.id,
    project_id: row.project_id,
    user_id: row.user_id,
    role: normalizeRole(row.role),
    status: 'active',
    username: user?.username || null,
    email: user?.email || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function publicInvite(row) {
  return {
    id: row.id,
    project_id: row.project_id,
    token: row.token,
    role: normalizeRole(row.role),
    status: row.status || 'pending',
    invited_by: row.invited_by,
    accepted_by: row.accepted_by || null,
    email: row.email || null,
    expires_at: row.expires_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const FRIENDS_MATURITY = 'ga';

async function listMembers(projectId) {
  const rows = await ProjectMember.findAll({ where: { project_id: String(projectId) } });
  const out = [];
  for (const row of rows) {
    let user = null;
    try {
      user = await User.find(row.user_id);
    } catch (_) { /* ignore */ }
    out.push(publicMember(row, user));
  }
  return out;
}

async function ensureOwner(projectId, userId) {
  const members = await ProjectMember.findAll({ where: { project_id: String(projectId) } });
  if (members.length) return members;
  if (!userId) return members;
  await ProjectMember.create({
    project_id: String(projectId),
    user_id: String(userId),
    role: 'owner',
  });
  return ProjectMember.findAll({ where: { project_id: String(projectId) } });
}

async function addMember(projectId, { user_id, role }, actorId) {
  if (!user_id) {
    const err = new Error('user_id is required');
    err.status = 400;
    throw err;
  }
  await ensureOwner(projectId, actorId);
  const existing = await ProjectMember.findAll({ where: { project_id: String(projectId) } });
  const dup = existing.find((m) => String(m.user_id) === String(user_id));
  if (dup) {
    const err = new Error('user is already a member');
    err.status = 409;
    throw err;
  }
  const row = await ProjectMember.create({
    project_id: String(projectId),
    user_id: String(user_id),
    role: normalizeRole(role, 'member'),
  });
  let user = null;
  try { user = await User.find(user_id); } catch (_) { /* ignore */ }
  return publicMember(row, user);
}

async function updateMemberRole(projectId, userId, role) {
  const r = normalizeRole(role);
  if (!MEMBER_ROLES.includes(r)) {
    const err = new Error('invalid role');
    err.status = 400;
    throw err;
  }
  const rows = await ProjectMember.findAll({ where: { project_id: String(projectId) } });
  const row = rows.find((m) => String(m.user_id) === String(userId));
  if (!row) {
    const err = new Error('member not found');
    err.status = 404;
    throw err;
  }
  const updated = await ProjectMember.update(row.id, { role: r });
  let user = null;
  try { user = await User.find(userId); } catch (_) { /* ignore */ }
  return publicMember(updated || { ...row, role: r }, user);
}

async function revokeMember(projectId, userId) {
  const rows = await ProjectMember.findAll({ where: { project_id: String(projectId) } });
  const row = rows.find((m) => String(m.user_id) === String(userId));
  if (!row) {
    const err = new Error('member not found');
    err.status = 404;
    throw err;
  }
  if (normalizeRole(row.role) === 'owner') {
    const owners = rows.filter((m) => normalizeRole(m.role) === 'owner');
    if (owners.length <= 1) {
      const err = new Error('cannot revoke the last owner');
      err.status = 400;
      throw err;
    }
  }
  await ProjectMember.delete(row.id);
  return { revoked: true, user_id: String(userId), status: 'revoked' };
}

/** Member leaves the project (self). Last owner cannot leave without transferring ownership. */
async function leaveProject(projectId, userId) {
  return revokeMember(projectId, userId);
}

/**
 * Owner/admin clears all membership + pending invites → project becomes open again.
 */
async function clearMembership(projectId) {
  const members = await ProjectMember.findAll({ where: { project_id: String(projectId) } });
  for (const row of members) {
    await ProjectMember.delete(row.id);
  }
  const invites = await ProjectInvite.findAll({ where: { project_id: String(projectId) } });
  for (const row of invites) {
    await ProjectInvite.delete(row.id);
  }
  return { cleared: true, members_removed: members.length, invites_removed: invites.length, status: 'open' };
}

async function createInvite(projectId, { role, ttl_ms, email } = {}, actorId) {
  await ensureOwner(projectId, actorId);
  const token = crypto.randomBytes(24).toString('hex');
  const ttl = Number(ttl_ms) > 0 ? Number(ttl_ms) : DEFAULT_TTL_MS;
  const expires_at = new Date(Date.now() + ttl).toISOString();
  const row = await ProjectInvite.create({
    project_id: String(projectId),
    token,
    role: normalizeRole(role, 'member'),
    invited_by: actorId ? String(actorId) : '',
    status: 'pending',
    expires_at,
    accepted_by: '',
    email: email ? String(email).trim() : '',
  });
  return publicInvite(row);
}

async function listInvites(projectId) {
  const rows = await ProjectInvite.findAll({ where: { project_id: String(projectId) } });
  return rows.map(publicInvite);
}

async function revokeInvite(projectId, inviteId) {
  const rows = await ProjectInvite.findAll({ where: { project_id: String(projectId) } });
  const row = rows.find((i) => String(i.id) === String(inviteId));
  if (!row) {
    const err = new Error('invite not found');
    err.status = 404;
    throw err;
  }
  const updated = await ProjectInvite.update(row.id, { status: 'revoked' });
  return publicInvite(updated || { ...row, status: 'revoked' });
}

async function acceptInvite(token, userId) {
  if (!token || !userId) {
    const err = new Error('token and authenticated user required');
    err.status = 400;
    throw err;
  }
  const rows = await ProjectInvite.findAll({ where: { token: String(token) } });
  const row = rows[0];
  if (!row) {
    const err = new Error('invite not found');
    err.status = 404;
    throw err;
  }
  if (row.status === 'revoked') {
    const err = new Error('invite revoked');
    err.status = 410;
    throw err;
  }
  if (row.status === 'accepted') {
    const err = new Error('invite already accepted');
    err.status = 409;
    throw err;
  }
  if (row.expires_at && Date.parse(row.expires_at) < Date.now()) {
    await ProjectInvite.update(row.id, { status: 'expired' });
    const err = new Error('invite expired');
    err.status = 410;
    throw err;
  }
  const projectId = row.project_id;
  const existing = await ProjectMember.findAll({ where: { project_id: String(projectId) } });
  let member = existing.find((m) => String(m.user_id) === String(userId));
  if (!member) {
    member = await ProjectMember.create({
      project_id: String(projectId),
      user_id: String(userId),
      role: normalizeRole(row.role, 'member'),
    });
  }
  await ProjectInvite.update(row.id, {
    status: 'accepted',
    accepted_by: String(userId),
  });
  let user = null;
  try { user = await User.find(userId); } catch (_) { /* ignore */ }
  return {
    project_id: projectId,
    invite: { ...publicInvite(row), status: 'accepted', accepted_by: String(userId) },
    member: publicMember(member, user),
  };
}

/**
 * Owner/admin can manage invites/members.
 * Open project (no members): only project creator or admin may bootstrap ACL.
 * Legacy projects without created_by: first authenticated actor may bootstrap.
 */
async function actorCanManage(req, projectId, projectIdMembers) {
  if (req.user?.role === 'admin') return true;
  const uid = req.userId || req.user?.id;
  if (!uid) return false;
  const members = projectIdMembers || await ProjectMember.findAll({ where: { project_id: String(projectId) } });
  const row = members.find((m) => String(m.user_id) === String(uid));
  if (row) return roleRank(row.role) >= roleRank('owner');
  if (members.length) return false;
  const { Project } = require('../models');
  let project = null;
  try {
    const rows = await Project.findAll({ where: { id: String(projectId) } });
    project = rows[0] || null;
  } catch (_) { /* ignore */ }
  const createdBy = project?.created_by ? String(project.created_by) : '';
  if (!createdBy) return true; // legacy open bootstrap
  return createdBy === String(uid);
}

module.exports = {
  listMembers,
  addMember,
  updateMemberRole,
  revokeMember,
  leaveProject,
  clearMembership,
  createInvite,
  listInvites,
  revokeInvite,
  acceptInvite,
  ensureOwner,
  actorCanManage,
  publicMember,
  publicInvite,
  MEMBER_ROLES,
  FRIENDS_MATURITY,
};
