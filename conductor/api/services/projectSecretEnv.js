const axios = require('axios');

/**
 * Stored secret *name* (as created in the UI) → process env var exposed to the service container.
 * Keep names in sync with Key Manager "Service secrets" presets and worker `.env_example`.
 */
const SECRET_NAME_TO_ENV_BY_SERVICE = {
  tunnel_manager: {
    cloudflare_api_token: 'CLOUDFLARE_API_TOKEN',
    cloudflare_account_id: 'CLOUDFLARE_ACCOUNT_ID'
  },
  domain_manager: {
    cloudflare_api_token: 'CLOUDFLARE_API_TOKEN',
    cloudflare_account_id: 'CLOUDFLARE_ACCOUNT_ID',
    cloudflare_zone_id: 'CLOUDFLARE_ZONE_ID'
  }
};

function upsertEnvLine(envList, key, value) {
  const list = Array.isArray(envList) ? [...envList] : [];
  const prefix = `${key}=`;
  const next = list.filter((line) => !String(line).startsWith(prefix));
  if (value != null && String(value) !== '') {
    next.push(`${key}=${String(value).replace(/\n/g, ' ').trim()}`);
  }
  return next;
}

function internalBaseUrl() {
  if (process.env.CONDUCTOR_INTERNAL_BASE_URL) {
    return process.env.CONDUCTOR_INTERNAL_BASE_URL.replace(/\/$/, '');
  }
  const port = process.env.PORT || 3000;
  return `http://127.0.0.1:${port}`;
}

/**
 * List project secrets, reveal matching ones, and merge into `serviceConfig.environment`.
 * Fails soft: throws only on unexpected errors; log at call site.
 *
 * @param {object} opts
 * @param {string} opts.serviceName
 * @param {string} opts.projectId
 * @param {object} opts.serviceConfig - mutated in place
 * @param {string} opts.bearerToken - conductor / service token accepted by `secrets_manager` proxy
 */
async function mergeProjectSecretsIntoConfig(opts) {
  const { serviceName, projectId, serviceConfig, bearerToken } = opts;
  const map = SECRET_NAME_TO_ENV_BY_SERVICE[serviceName];
  if (!map || !projectId || !bearerToken) {
    return { injected: 0, skipped: 'no map or project' };
  }

  if (!serviceConfig.environment) {
    serviceConfig.environment = [];
  }

  const base = internalBaseUrl();
  const listUrl = `${base}/api/services/secrets_manager/api/v1/secrets`;
  const listRes = await axios.get(listUrl, {
    params: { project_id: projectId, environment: 'prod' },
    headers: { Authorization: `Bearer ${bearerToken}` },
    timeout: 20000,
    validateStatus: (s) => s < 500
  });

  if (listRes.status === 401 || listRes.status === 403) {
    throw new Error(
      `secrets list auth failed (${listRes.status}) — check conductor service token for internal calls`
    );
  }
  if (listRes.status === 404 || listRes.status === 503) {
    return { injected: 0, skipped: `secrets_manager returned ${listRes.status}` };
  }
  if (listRes.status !== 200 || !listRes.data?.secrets) {
    return { injected: 0, skipped: `unexpected list response ${listRes.status}` };
  }

  const wantedNames = new Set(Object.keys(map));
  const rows = (listRes.data.secrets || []).filter((r) => wantedNames.has(r.name));
  let injected = 0;

  for (const row of rows) {
    const envName = map[row.name];
    if (!envName) {
      continue;
    }
    const getUrl = `${base}/api/services/secrets_manager/api/v1/secrets/${row.id}`;
    const getRes = await axios.get(getUrl, {
      params: { project_id: projectId, reveal: '1' },
      headers: { Authorization: `Bearer ${bearerToken}` },
      timeout: 20000,
      validateStatus: (s) => s < 500
    });
    if (getRes.status !== 200 || getRes.data?.secret?.value == null) {
      continue;
    }
    const value = getRes.data.secret.value;
    serviceConfig.environment = upsertEnvLine(serviceConfig.environment, envName, value);
    injected += 1;
  }

  return { injected, skipped: null };
}

module.exports = {
  mergeProjectSecretsIntoConfig,
  upsertEnvLine,
  SECRET_NAME_TO_ENV_BY_SERVICE
};
