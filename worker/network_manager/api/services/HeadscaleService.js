'use strict';

const crypto = require('crypto');
const { HeadscaleNode } = require('../models');

class HeadscaleService {
  constructor(deps = {}) {
    this.M = deps.M || HeadscaleNode;
  }

  enabled() {
    return Boolean(process.env.HEADSCALE_URL);
  }

  async meshStatus() {
    return {
      enabled: this.enabled(),
      login_server: process.env.HEADSCALE_URL || null,
      base_domain: process.env.HEADSCALE_BASE_DOMAIN || 'aerekos.internal',
      nodes: this.enabled() ? await this.M.findAll() : [],
    };
  }

  async mintPreauth({ project_id, tags } = {}) {
    const tagList = tags || ['tag:worker'];
    let key = `hskey_${crypto.randomBytes(16).toString('hex')}`;
    let nodeId = '';
    if (this.enabled() && process.env.HEADSCALE_API_KEY) {
      try {
        const client = require('../../../vpn_manager/api/services/HeadscaleClient');
        const remote = await client.createPreauthKey({
          user: process.env.HEADSCALE_USER || '1',
          reusable: true,
          aclTags: tagList,
        });
        key = remote.preAuthKey?.key || remote.key || key;
        nodeId = remote.preAuthKey?.id || remote.id || '';
      } catch (e) {
        console.warn('[network_manager] Headscale API mint failed, local key:', e.message);
      }
    }
    const row = await this.M.create({
      project_id: project_id || '',
      node_id: nodeId,
      hostname: '',
      preauth_key: key,
      tags: JSON.stringify(tagList),
      status: 'issued',
    });
    return { id: row.id, preauth_key: key, shown_once: true, tags: tagList };
  }

  async revoke(id, { force } = {}) {
    const rows = await this.M.findAll({ where: { id } });
    if (!rows.length) {
      const e = new Error('Not found');
      e.status = 404;
      throw e;
    }
    const tags = (() => { try { return JSON.parse(rows[0].tags || '[]'); } catch { return []; } })();
    if (!force && (tags.includes('tag:worker') || tags.includes('tag:platform'))) {
      const e = new Error('refusing to revoke fleet mesh node');
      e.status = 403;
      throw e;
    }
    await this.M.update(id, { status: 'revoked', preauth_key: '' });
    return { revoked: true, id };
  }

  async revokeByHostname(hostname) {
    const rows = await this.M.findAll({ where: { hostname: hostname || '' } });
    const out = [];
    for (const row of rows) {
      out.push(await this.revoke(row.id, { force: true }));
    }
    return { revoked: out.length };
  }

  async deleteNode(id) {
    return this.revoke(id);
  }
}

module.exports = { HeadscaleService };
