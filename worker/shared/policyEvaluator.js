'use strict';

const arn = require('./arn');

/**
 * Evaluate IAM-style policy documents: { actions: string[], resources: string[] }.
 * Deny beats allow; default deny.
 *
 * @param {Array<{ effect: 'allow'|'deny', document: object|string }>} policies
 * @param {{ action: string, resourceArn: string }} request
 * @returns {{ allowed: boolean, matched: 'allow'|'deny'|null, reason: string }}
 */
function evaluatePolicies(policies, request) {
  const { action, resourceArn } = request;
  if (!action || !resourceArn) {
    return { allowed: false, matched: null, reason: 'action and resourceArn required' };
  }

  let allowHit = false;

  for (const policy of policies || []) {
    const doc = typeof policy.document === 'string'
      ? safeParse(policy.document)
      : (policy.document || {});
    if (!statementMatches(doc, action, resourceArn)) continue;

    const effect = String(policy.effect || 'allow').toLowerCase();
    if (effect === 'deny') {
      return { allowed: false, matched: 'deny', reason: `denied by policy ${policy.name || policy.id || ''}`.trim() };
    }
    if (effect === 'allow') allowHit = true;
  }

  if (allowHit) {
    return { allowed: true, matched: 'allow', reason: 'allowed by matching policy' };
  }
  return { allowed: false, matched: null, reason: 'no matching allow policy' };
}

function safeParse(raw) {
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

function normalizeList(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String).filter(Boolean);
  if (typeof val === 'string') return val.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}

function actionMatches(pattern, action) {
  const p = String(pattern).trim();
  const a = String(action).trim();
  if (!p || !a) return false;
  if (p === '*') return true;
  if (p === a) return true;
  if (p.endsWith(':*')) {
    const ns = p.slice(0, -2);
    return a === ns || a.startsWith(`${ns}:`);
  }
  return false;
}

function resourceMatches(pattern, resourceArn) {
  const p = String(pattern).trim();
  if (!p) return false;
  if (p === '*') return true;
  return arn.isAllowed([p], resourceArn);
}

function statementMatches(document, action, resourceArn) {
  const actions = normalizeList(document.actions || document.action);
  const resources = normalizeList(document.resources || document.resource);
  if (!actions.length || !resources.length) return false;

  const actionOk = actions.some((pat) => actionMatches(pat, action));
  if (!actionOk) return false;

  return resources.some((pat) => resourceMatches(pat, resourceArn));
}

/**
 * Validate resource entries in a policy document (ARN spec + wildcards).
 * @returns {string[]} invalid patterns
 */
function validatePolicyResources(document) {
  const doc = typeof document === 'string' ? safeParse(document) : (document || {});
  const resources = normalizeList(doc.resources || doc.resource);
  const invalid = [];
  for (const r of resources) {
    if (r === '*') continue;
    if (r.includes('*')) {
      if (!/^arn:aerekos:[^*]+/.test(r) && r !== '*') {
        const prefix = r.replace(/\*+$/, '');
        if (prefix && !prefix.startsWith('arn:aerekos:')) invalid.push(r);
      }
      continue;
    }
    if (!arn.parse(r)) invalid.push(r);
  }
  return invalid;
}

module.exports = {
  evaluatePolicies,
  validatePolicyResources,
  statementMatches,
  actionMatches,
  resourceMatches,
};
