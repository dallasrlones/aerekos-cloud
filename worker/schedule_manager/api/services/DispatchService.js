const axios = require('axios');

const DEFAULT_WEBHOOK_TIMEOUT = parseInt(process.env.WEBHOOK_TIMEOUT_MS || '30000', 10);

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
    const base = (process.env.QUEUE_MANAGER_URL || 'http://127.0.0.1:3101').replace(/\/$/, '');
    const url = `${base}/api/v1/queues/${encodeURIComponent(s.target_queue)}/messages`;
    const body = s.message_template != null && String(s.message_template).length > 0
      ? s.message_template
      : JSON.stringify({ event: 'scheduled', schedule: s.name, at: new Date().toISOString() });
    const res = await this.http.post(
      url,
      { project_id: s.project_id, body },
      {
        headers: { 'Content-Type': 'application/json' },
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
