/**
 * Fetch decrypted secret values from secrets_manager (KMS envelope via key_manager).
 * Used by auth_manager (signing secret) and other managers that need runtime secrets.
 *
 * Env:
 *   SECRETS_MANAGER_URL     e.g. http://secrets_manager:3114
 *   DEFAULT_PROJECT_ID      project scope for platform secrets
 *   SERVICE_TOKEN           conductor-issued token for service-to-service calls
 */

async function fetchJson(url, opts = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), opts.timeoutMs || 8000);
  try {
    const headers = { Accept: 'application/json', ...(opts.headers || {}) };
    const res = await fetch(url, { ...opts, headers, signal: controller.signal });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(t);
  }
}

function baseUrl() {
  return (process.env.SECRETS_MANAGER_URL || '').replace(/\/$/, '');
}

/** Normalize list/reveal paths whether base ends with /api/v1 or is a bare host. */
function secretsApiRoot(base) {
  const b = (base || baseUrl()).replace(/\/$/, '');
  if (!b) return '';
  if (b.endsWith('/api/v1')) return b;
  return `${b}/api/v1`;
}

function projectId() {
  return process.env.DEFAULT_PROJECT_ID || process.env.PROJECT_ID || '';
}

function authHeaders() {
  const token = process.env.SERVICE_TOKEN || process.env.CONDUCTOR_SERVICE_TOKEN;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

/**
 * Resolve a secret by name within a project. Returns plaintext or null.
 * @param {string} name - secret name (e.g. auth_manager.signing_secret)
 * @param {string} [pid] - override project id
 */
async function getSecretValue(name, pid) {
  const base = baseUrl();
  const project = pid || projectId();
  if (!base || !project || !name) return null;

  const root = secretsApiRoot(base);
  const list = await fetchJson(
    `${root}/secrets?project_id=${encodeURIComponent(project)}`,
    { headers: authHeaders() },
  );
  if (!list.ok) return null;
  const secrets = list.data?.secrets || [];
  const row = secrets.find((s) => s.name === name);
  if (!row?.id) return null;

  const reveal = await fetchJson(
    `${root}/secrets/${row.id}?project_id=${encodeURIComponent(project)}&reveal=1`,
    { headers: authHeaders() },
  );
  if (!reveal.ok) return null;
  return reveal.data?.secret?.value || null;
}

module.exports = { getSecretValue, baseUrl, projectId, secretsApiRoot };
