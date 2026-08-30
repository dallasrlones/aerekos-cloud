'use strict';

/**
 * OAuth-style scope checks for app credentials.
 * Scopes are space-delimited in JWT claim `scope` (string) or `scopes` (array).
 * @see docs/plans/platform_app_access.md
 */

function normalizeScopes(claim) {
  if (!claim) return [];
  if (Array.isArray(claim)) return claim.filter(Boolean).map(String);
  if (typeof claim === 'string') return claim.split(/\s+/).filter(Boolean);
  return [];
}

/**
 * @param {string|string[]|undefined} granted - token scope claim
 * @param {string} required - e.g. ai:InvokeLlm
 */
function hasScope(granted, required) {
  if (!required) return true;
  const scopes = normalizeScopes(granted);
  if (scopes.includes('*')) return true;
  if (scopes.includes(required)) return true;
  // Namespace wildcard: ai:* grants ai:InvokeLlm
  const ns = required.split(':')[0];
  if (ns && scopes.includes(`${ns}:*`)) return true;
  return false;
}

/**
 * @param {string|string[]|undefined} granted
 * @param {string[]} requiredAll - all must be present
 */
function hasAllScopes(granted, requiredAll) {
  if (!requiredAll || requiredAll.length === 0) return true;
  return requiredAll.every((s) => hasScope(granted, s));
}

/**
 * @param {string|string[]|undefined} granted
 * @param {string[]} requiredAny - at least one
 */
function hasAnyScope(granted, requiredAny) {
  if (!requiredAny || requiredAny.length === 0) return true;
  return requiredAny.some((s) => hasScope(granted, s));
}

module.exports = {
  normalizeScopes,
  hasScope,
  hasAllScopes,
  hasAnyScope,
};
