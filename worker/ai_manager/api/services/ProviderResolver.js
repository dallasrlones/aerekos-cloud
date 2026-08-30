const { AiProviderService } = require('./AiProviderService');
const { getSecretValue } = require('../../../shared/secretsClient');
const { parseEndpointArn } = require('./EndpointArn');

function parseOptions(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch (_) { return {}; }
}

function truthy(v) {
  return v === true || v === 'true' || v === '1' || v === 1;
}

class ProviderResolver {
  constructor() {
    this.providers = new AiProviderService();
  }

  projectId(req) {
    return req.query?.project_id || req.body?.project_id || req.headers?.['x-project-id'] || null;
  }

  integrationName(req) {
    return req.body?.integration || req.body?.provider || req.query?.integration || req.query?.provider || null;
  }

  resourceArn(req) {
    return req.body?.resource || req.headers?.['x-aerekos-resource'] || null;
  }

  async resolve(req, capability) {
    const resourceRaw = this.resourceArn(req);
    if (resourceRaw) {
      const parsed = parseEndpointArn(resourceRaw);
      if (!parsed) return null;
      if (parsed.capability !== capability) return null;
      const row = await this.providers.getByName(parsed.projectId, parsed.name, capability);
      if (!row || row.enabled === 'false') return null;
      return this.toResolved(row, parsed.projectId, capability);
    }

    const projectId = this.projectId(req);
    if (!projectId) return null;

    const name = this.integrationName(req);
    let row;
    if (name) {
      row = await this.providers.getByName(projectId, name, capability);
    } else {
      row = await this.providers.getDefault(projectId, capability);
    }
    if (!row || row.enabled === 'false') return null;
    return this.toResolved(row, projectId, capability);
  }

  async toResolved(row, projectId, capability) {
    const options = parseOptions(row.options);
    let apiKey = null;
    const pid = projectId || row.project_id;
    if (row.secret_ref) {
      apiKey = await getSecretValue(row.secret_ref, pid);
    }

    return {
      id: row.id,
      name: row.name,
      arn: row.arn,
      capability: row.capability || capability,
      provider_type: row.provider,
      endpoint: (row.endpoint || '').replace(/\/$/, ''),
      model: row.model || null,
      apiKey,
      options,
    };
  }
}

module.exports = { ProviderResolver };
