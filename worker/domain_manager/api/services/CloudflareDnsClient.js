const axios = require('axios');

const BASE = 'https://api.cloudflare.com/client/v4';

class CloudflareDnsClient {
  constructor(opts = {}) {
    this.token = opts.token || process.env.CLOUDFLARE_API_TOKEN;
    this.http = opts.http || axios;
  }

  headers() {
    if (!this.token) {
      const e = new Error('Set CLOUDFLARE_API_TOKEN');
      e.status = 503;
      e.code = 'CLOUDFLARE_NOT_CONFIGURED';
      throw e;
    }
    return {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    };
  }

  async listZones({ accountId, name } = {}) {
    const params = { per_page: 50 };
    if (accountId) params['account.id'] = accountId;
    if (name) params.name = name;
    const { data } = await this.http.get(`${BASE}/zones`, {
      headers: this.headers(),
      params,
    });
    if (!data.success) {
      const err = new Error((data.errors && data.errors[0] && data.errors[0].message) || 'Cloudflare zones error');
      err.status = 502;
      throw err;
    }
    return data.result || [];
  }

  async listRecords(zoneId, { name, type } = {}) {
    const params = { per_page: 100 };
    if (name) params.name = name;
    if (type) params.type = type;
    const { data } = await this.http.get(`${BASE}/zones/${zoneId}/dns_records`, {
      headers: this.headers(),
      params
    });
    if (!data.success) {
      const err = new Error((data.errors && data.errors[0] && data.errors[0].message) || 'Cloudflare error');
      err.status = 502;
      throw err;
    }
    return data.result;
  }

  async createRecord(zoneId, { name, type, content, ttl, proxied }) {
    const { data } = await this.http.post(
      `${BASE}/zones/${zoneId}/dns_records`,
      { name, type, content, ttl: ttl == null ? 1 : ttl, proxied: !!proxied },
      { headers: this.headers() }
    );
    if (!data.success) {
      const err = new Error((data.errors && data.errors[0] && data.errors[0].message) || 'Cloudflare error');
      err.status = 400;
      err.cf = data.errors;
      throw err;
    }
    return data.result;
  }

  async updateRecord(zoneId, recordId, patch) {
    const { data } = await this.http.put(
      `${BASE}/zones/${zoneId}/dns_records/${recordId}`,
      patch,
      { headers: this.headers() }
    );
    if (!data.success) {
      const err = new Error((data.errors && data.errors[0] && data.errors[0].message) || 'Cloudflare error');
      err.status = 400;
      throw err;
    }
    return data.result;
  }

  async deleteRecord(zoneId, recordId) {
    const { data } = await this.http.delete(`${BASE}/zones/${zoneId}/dns_records/${recordId}`, {
      headers: this.headers()
    });
    if (!data.success) {
      const err = new Error((data.errors && data.errors[0] && data.errors[0].message) || 'Cloudflare error');
      err.status = 400;
      throw err;
    }
    return true;
  }
}

module.exports = { CloudflareDnsClient, BASE };
