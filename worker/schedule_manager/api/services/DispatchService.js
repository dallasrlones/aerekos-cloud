const axios = require('axios');

const DEFAULT_WEBHOOK_TIMEOUT = parseInt(process.env.WEBHOOK_TIMEOUT_MS || '30000', 10);

/** Mirror worker/shared/conductorProxy.authHeaders without requiring that module (axios resolve). */
function conductorAuthHeaders(projectId, extra = {}) {
  const tok = process.env.CONDUCTOR_TOKEN
    || process.env.SERVICE_TOKEN
    || process.env.AEREKOS_AGENT_TOKEN
    || '';
  return {
    'Content-Type': 'application/json',
    ...(tok ? {
      Authorization: `Bearer ${tok}`,
      'x-aerekos-agent-token': tok,
    } : {}),
    ...(projectId ? { 'x-project-id': projectId } : {}),
    ...extra,
  };
}

class DispatchService {
  /**
   * @param {{ get: (url, opts?) => Promise, post: (url, data, opts?) => Promise }} [http]
   */
  constructor(http = axios) {
    this.http = http;
  }

  /**
   * @param {import('../models').Schedule} schedule - row from DB
   */
  async dispatch(schedule) {
    if (schedule.action_type === 'webhook') {
      return this._webhook(schedule);
    }
    if (schedule.action_type === 'queue') {
      return this._queue(schedule);
    }
    throw new Error(`Unknown action_type: ${schedule.action_type}`);
  }

  async _webhook(s) {
    if (!s.target_url) {
      throw new Error('target_url is required for webhook');
    }
    const method = (s.http_method || 'POST').toUpperCase();
    const headers = { 'Content-Type': 'application/json' };
    if (s.request_headers) {
      try {
        const extra = JSON.parse(s.request_headers);
        Object.assign(headers, extra);
      } catch (e) {
        throw new Error('request_headers must be valid JSON when set');
      }
    }
    let data = s.message_template;
    if (data && (data.trim().startsWith('{') || data.trim().startsWith('['))) {
      try {
        data = JSON.parse(data);
      } catch (e) {
        /* use raw string */
      }
    }
    const opts = { headers, timeout: DEFAULT_WEBHOOK_TIMEOUT, validateStatus: () => true };
    let res;
    if (method === 'GET' || method === 'HEAD') {
      res = await this.http.get(s.target_url, opts);
    } else {
      res = await this.http.post(s.target_url, data || {}, opts);
    }
    if (res.status >= 400) {
      const err = new Error(`Webhook returned HTTP ${res.status}`);
      err.status = res.status;
      err.data = res.data;
      throw err;
    }
    return { ok: true, status: res.status, action: 'webhook' };
  }

  async _queue(s) {
    if (!s.target_queue) {
      throw new Error('target_queue is required for queue');
    }
    const body = s.message_template != null && String(s.message_template).length > 0
      ? s.message_template
      : JSON.stringify({ event: 'scheduled', schedule: s.name, at: new Date().toISOString() });

    // Prefer conductor sibling proxy (platform rule: never call managers by host port).
    // QUEUE_MANAGER_URL remains a test/dev escape hatch only — no localhost default.
    let url;
    let headers = { 'Content-Type': 'application/json' };
    if (process.env.QUEUE_MANAGER_URL) {
      const base = String(process.env.QUEUE_MANAGER_URL).replace(/\/$/, '');
      url = `${base}/api/v1/queues/${encodeURIComponent(s.target_queue)}/messages`;
    } else {
      const conductor = process.env.CONDUCTOR_URL || process.env.CONDUCTOR_INTERNAL_BASE_URL;
      if (!conductor) {
        const err = new Error('CONDUCTOR_URL required to reach queue_manager (or set QUEUE_MANAGER_URL for direct/test)');
        err.status = 503;
        throw err;
      }
      url = `${String(conductor).replace(/\/$/, '')}/api/services/queue_manager/api/v1/queues/${encodeURIComponent(s.target_queue)}/messages`;
      headers = conductorAuthHeaders(s.project_id);
    }

    const res = await this.http.post(
      url,
      { project_id: s.project_id, body },
      {
        headers,
        timeout: DEFAULT_WEBHOOK_TIMEOUT,
        validateStatus: () => true
      }
    );
    if (res.status >= 400) {
      const err = new Error(`queue_manager returned HTTP ${res.status}`);
      err.status = res.status;
      err.data = res.data;
      throw err;
    }
    return { ok: true, status: res.status, action: 'queue', data: res.data };
  }
}

module.exports = { DispatchService };
