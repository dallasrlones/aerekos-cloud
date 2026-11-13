'use strict';

const MEMBER_ROLES = ['owner', 'member', 'viewer'];
const ROLE_RANK = { viewer: 1, member: 2, owner: 3 };

function roleRank(role) {
  return ROLE_RANK[String(role || 'member')] || 0;
}

function normalizeRole(role, fallback = 'member') {
  const r = String(role || fallback).toLowerCase();
  return MEMBER_ROLES.includes(r) ? r : fallback;
}

module.exports = { MEMBER_ROLES, ROLE_RANK, roleRank, normalizeRole };
