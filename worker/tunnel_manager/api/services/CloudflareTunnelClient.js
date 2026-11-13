/**
 * Cloudflare tunnel API adapter — default {@link TunnelProvider} implementation.
 * @see worker/shared/edgeProviders.js · docs/architecture/edge-providers.md
 */
const axios = require('axios');

const BASE = 'https://api.cloudflare.com/client/v4/accounts';

class CloudflareTunnelClient {
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

  async createTunnel(accountId, { name, config_src = 'cloudflare' }) {
    const { data } = await this.http.post(
      `${BASE}/${accountId}/cfd_tunnel`,
      { name, config_src },
      { headers: this.headers() }
    );
    if (!data.success) {
      const err = new Error(
        (data.errors && data.errors[0] && data.errors[0].message) || 'Cloudflare error'
      );
      err.status = 400;
      err.cf = data.errors;
      throw err;
    }
    return data.result;
  }

  async getTunnel(accountId, tunnelId) {
    const { data } = await this.http.get(`${BASE}/${accountId}/cfd_tunnel/${tunnelId}`, {
      headers: this.headers()
    });
    if (!data.success) {
      const err = new Error(
        (data.errors && data.errors[0] && data.errors[0].message) || 'Cloudflare error'
      );
      err.status = 404;
      throw err;
    }
    return data.result;
  }

  async deleteTunnel(accountId, tunnelId) {
    const { data } = await this.http.delete(`${BASE}/${accountId}/cfd_tunnel/${tunnelId}`, {
      headers: this.headers()
    });
    if (!data.success) {
      const err = new Error(
        (data.errors && data.errors[0] && data.errors[0].message) || 'Cloudflare error'
      );
      err.status = 400;
      throw err;
    }
    return true;
  }

  async listTunnels(accountId) {
    const { data } = await this.http.get(`${BASE}/${accountId}/cfd_tunnel`, {
      headers: this.headers(),
      params: { is_deleted: false },
    });
    if (!data.success) {
      const err = new Error(
        (data.errors && data.errors[0] && data.errors[0].message) || 'Cloudflare list error'
      );
      err.status = 400;
      throw err;
    }
    return data.result || [];
  }

  async getIngress(accountId, tunnelId) {
    const { data } = await this.http.get(
      `${BASE}/${accountId}/cfd_tunnel/${tunnelId}/configurations`,
      { headers: this.headers() }
    );
    if (!data.success) {
      const err = new Error(
        (data.errors && data.errors[0] && data.errors[0].message) || 'Cloudflare ingress read error'
      );
      err.status = 400;
      err.cf = data.errors;
      throw err;
    }
    const ingress = data.result?.config?.ingress || data.result?.ingress || [];
    return Array.isArray(ingress) ? ingress : [];
  }

  async putIngress(accountId, tunnelId, ingress) {
    const { data } = await this.http.put(
      `${BASE}/${accountId}/cfd_tunnel/${tunnelId}/configurations`,
      { config: { ingress: Array.isArray(ingress) ? ingress : [] } },
      { headers: this.headers() }
    );
    if (!data.success) {
      const err = new Error(
        (data.errors && data.errors[0] && data.errors[0].message) || 'Cloudflare ingress error'
      );
      err.status = 400;
      err.cf = data.errors;
      throw err;
    }
    return data.result;
  }
}

module.exports = { CloudflareTunnelClient, BASE };
