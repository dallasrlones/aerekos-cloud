'use strict';

/**
 * Platform ARN utilities — arn:aerekos:{project_id}:{namespace}:{resource_type}/{name}
 * @see docs/plans/platform_app_access.md
 */

const PREFIX = 'arn:aerekos:';
const NAME_RE = /^[a-z0-9][a-z0-9-_]{0,63}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidName(name) {
  return typeof name === 'string' && NAME_RE.test(name);
}

function isValidProjectId(projectId) {
  return typeof projectId === 'string' && UUID_RE.test(projectId);
}

/**
 * @param {{ projectId: string, namespace: string, resourceType: string, name: string }} parts
 * @returns {string}
 */
function build({ projectId, namespace, resourceType, name }) {
  if (!isValidProjectId(projectId)) {
    const e = new Error('invalid project_id'); e.code = 'InvalidArn'; throw e;
  }
  if (!namespace || !resourceType) {
    const e = new Error('namespace and resourceType required'); e.code = 'InvalidArn'; throw e;
  }
  if (!isValidName(name)) {
    const e = new Error('invalid resource name'); e.code = 'InvalidArn'; throw e;
  }
  return `${PREFIX}${projectId}:${namespace}:${resourceType}/${name}`;
}

/**
 * @param {string} arn
 * @returns {{ projectId: string, namespace: string, resourceType: string, name: string, raw: string } | null}
 */
function parse(arn) {
  if (typeof arn !== 'string' || !arn.startsWith(PREFIX)) return null;
  const rest = arn.slice(PREFIX.length);
  const slash = rest.indexOf('/');
  if (slash < 0) return null;
  const name = rest.slice(slash + 1);
  const head = rest.slice(0, slash);
  if (!name) return null;

  const m = head.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}):(.+)$/i);
  if (!m) return null;
  const projectId = m[1];
  const tail = m[2];
  const colon = tail.indexOf(':');
  const namespace = colon < 0 ? tail : tail.slice(0, colon);
  const resourceType = colon < 0 ? tail : tail.slice(colon + 1);
  if (!namespace || !resourceType) return null;
  return { projectId, namespace, resourceType, name, raw: arn };
}

/**
 * Wildcard match for IAM-style allowed_resources patterns.
 * Supports `*` only as the final path segment (name or whole suffix).
 * @param {string} pattern - allowed pattern or exact ARN
 * @param {string} arn - concrete resource ARN
 */
function matches(pattern, arn) {
  if (!pattern || !arn) return false;
  if (pattern === arn) return true;
  if (!pattern.includes('*')) return false;

  const p = parse(pattern);
  const a = parse(arn);
  if (!p || !a) return false;
  if (p.projectId !== a.projectId) return false;
  if (p.namespace !== a.namespace && p.namespace !== '*') return false;
  if (p.resourceType !== a.resourceType && p.resourceType !== '*') return false;

  if (p.name === '*') return true;
  if (p.name.endsWith('*')) {
    const prefix = p.name.slice(0, -1);
    return a.name.startsWith(prefix);
  }
  return p.name === a.name;
}

/**
 * @param {string[]} allowed - credential allowed_resources
 * @param {string} arn
 */
function isAllowed(allowed, arn) {
  if (!Array.isArray(allowed) || !arn) return false;
  return allowed.some((p) => matches(p, arn));
}

module.exports = {
  PREFIX,
  NAME_RE,
  build,
  parse,
  matches,
  isAllowed,
  isValidName,
  isValidProjectId,
};
