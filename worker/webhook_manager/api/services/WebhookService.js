const axios = require('axios');
const { WebhookEndpoint, WebhookDelivery } = require('../models');

function parseHeaders(raw) {
  if (!raw || !String(raw).trim()) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    const err = new Error('headers must be valid JSON object');
    err.status = 400;
    throw err;
  }
}

class WebhookService {
  constructor(deps = {}) {
    this.WebhookEndpoint = deps.WebhookEndpoint || WebhookEndpoint;
    this.WebhookDelivery = deps.WebhookDelivery || WebhookDelivery;
  }

  assertProjectId(projectId) {
    if (!projectId || String(projectId).trim() === '') {
      const e = new Error('project_id is required');
      e.status = 400;
      throw e;
    }
  }

  skipOutbound() {
    return process.env.SKIP_OUTBOUND === '1' || process.env.SKIP_OUTBOUND === 'true';
  }

  async createEndpoint(body) {
    this.assertProjectId(body.project_id);
    const name = String(body.name || '').trim();
    if (!name) {
      const e = new Error('name is required');
      e.status = 400;
      throw e;
    }
    const url = String(body.target_url || '').trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      const e = new Error('target_url must be http or https');
      e.status = 400;
      throw e;
    }
    const existing = await this.WebhookEndpoint.findAll({
      where: { project_id: body.project_id, name }
    });
    if (existing.length) {
      const e = new Error(`webhook name "${name}" already exists in this project`);
      e.status = 409;
      throw e;
    }
    if (body.headers) {
      parseHeaders(body.headers);
    }
    return this.WebhookEndpoint.create({
      project_id: body.project_id,
      name,
      target_url: url,
      secret: body.secret != null ? String(body.secret) : '',
      headers: body.headers != null ? String(body.headers) : '',
      enabled: body.enabled === false || body.enabled === '0' || body.enabled === 'false' ? '0' : '1'
    });
  }

  async listEndpoints(projectId) {
    this.assertProjectId(projectId);
    return this.WebhookEndpoint.findAll({ where: { project_id: projectId } });
  }

  async getEndpoint(id, projectId) {
    this.assertProjectId(projectId);
    const rows = await this.WebhookEndpoint.findAll({ where: { id, project_id: projectId } });
    if (!rows.length) {
      const e = new Error('Webhook not found');
      e.status = 404;
      throw e;
    }
    return rows[0];
  }

  async updateEndpoint(id, projectId, body = {}) {
    await this.getEndpoint(id, projectId);
    const patch = {};
    if (body.name !== undefined) {
      const name = String(body.name || '').trim();
      if (!name) { const e = new Error('name is required'); e.status = 400; throw e; }
      const dup = await this.WebhookEndpoint.findAll({ where: { project_id: projectId, name } });
      if (dup.some((d) => String(d.id) !== String(id))) {
        const e = new Error(`webhook name "${name}" already exists in this project`);
        e.status = 409;
        throw e;
      }
      patch.name = name;
    }
    if (body.target_url !== undefined) {
      const url = String(body.target_url || '').trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        const e = new Error('target_url must be http or https');
        e.status = 400;
        throw e;
      }
      patch.target_url = url;
    }
    if (body.secret !== undefined) {
      patch.secret = body.secret != null ? String(body.secret) : '';
    }
    if (body.headers !== undefined) {
      parseHeaders(body.headers);
      patch.headers = body.headers != null ? String(body.headers) : '';
    }
    if (body.enabled !== undefined) {
      patch.enabled =
        body.enabled === false || body.enabled === '0' || body.enabled === 'false' ? '0' : '1';
    }
    if (Object.keys(patch).length) {
      await this.WebhookEndpoint.update(id, patch);
    }
    return this.getEndpoint(id, projectId);
  }

  async deleteEndpoint(id, projectId) {
    const row = await this.getEndpoint(id, projectId);
    const dels = await this.WebhookDelivery.findAll({ where: { project_id: projectId, endpoint_id: id } });
    for (const d of dels) {
      await this.WebhookDelivery.delete(d.id);
    }
    await this.WebhookEndpoint.delete(id);
    return { deleted: true, id: row.id };
  }

  async dispatch(id, projectId, payload) {
    const ep = await this.getEndpoint(id, projectId);
    if (ep.enabled === '0') {
      const e = new Error('Webhook is disabled');
      e.status = 400;
      throw e;
    }
    const body = payload == null ? {} : payload;
    const json =
      typeof body === 'string' ? body : JSON.stringify(typeof body === 'object' ? body : { data: body });

    if (this.skipOutbound()) {
      const d = await this.WebhookDelivery.create({
        project_id: projectId,
        endpoint_id: id,
        payload: json,
        status: 'skipped',
        http_status: '0',
        error: '',
        response_snippet: 'SKIP_OUTBOUND=1 (no HTTP)'
      });
      return { delivery: d, mode: 'skip' };
    }

    const headers = {
      'Content-Type': 'application/json',
      ...parseHeaders(ep.headers)
    };
    if (ep.secret) {
      headers['X-Aerekos-Webhook-Secret'] = ep.secret;
    }

    let httpStatus = 0;
    let responseSnippet = '';
    let errMsg = '';
    let status = 'success';

    try {
      const res = await axios.post(ep.target_url, body, {
        headers,
        timeout: parseInt(process.env.WEBHOOK_HTTP_TIMEOUT_MS || '15000', 10),
        validateStatus: () => true
      });
      httpStatus = res.status;
      const snip = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      responseSnippet = snip.length > 2000 ? `${snip.slice(0, 2000)}…` : snip;
      if (res.status >= 400) {
        status = 'failed';
        errMsg = `HTTP ${res.status}`;
      }
    } catch (e) {
      status = 'failed';
      errMsg = e.message || 'request failed';
    }

    const d = await this.WebhookDelivery.create({
      project_id: projectId,
      endpoint_id: id,
      payload: json,
      status,
      http_status: String(httpStatus),
      error: errMsg,
      response_snippet: responseSnippet
    });
    return { delivery: d, mode: 'live' };
  }

  async listDeliveries(projectId, endpointId) {
    this.assertProjectId(projectId);
    return this.WebhookDelivery.findAll({
      where: { project_id: projectId, endpoint_id: endpointId }
    });
  }
}

module.exports = { WebhookService };
