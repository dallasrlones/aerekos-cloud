'use strict';

const { Connector } = require('../models');
const { isValidName } = require('../../../shared/arn');
const { enrichEndpoint } = require('./EndpointArn');
const { safeArn, json, fail } = require('./agentArn');
const { listKinds, getKind } = require('./connectorCatalog');

class ConnectorService {
  assertP(p) {
    if (!p) throw fail(400, 'project_id required');
  }

  kinds() {
    return listKinds();
  }

  serialize(row) {
    const base = typeof row.toJSON === 'function' ? row.toJSON() : { ...row };
    return enrichEndpoint({
      ...base,
      capability: 'connector',
      scopes: json(base.scopes, []),
      options: json(base.options, {}),
    });
  }

  async create(body) {
    this.assertP(body.project_id);
    const name = String(body.name || '').trim();
    if (!isValidName(name)) throw fail(400, 'invalid name');
    const kind = getKind(body.kind);
    const dup = await Connector.findAll({ where: { project_id: body.project_id, name } });
    if (dup.length) throw fail(409, 'name taken');
    const row = await Connector.create({
      project_id: body.project_id,
      name,
      kind: kind.name,
      auth: body.auth || kind.auth,
      secret_ref: String(body.secret_ref || ''),
      status: body.status || (body.secret_ref ? 'connected' : 'needs_auth'),
      scopes: JSON.stringify(body.scopes || []),
      arn: safeArn(body.project_id, 'connector', name),
      options: JSON.stringify(body.options || {}),
    });
    return this.serialize(row);
  }

  async list(projectId) {
    this.assertP(projectId);
    const rows = await Connector.findAll({ where: { project_id: projectId } });
    return rows.map((r) => this.serialize(r));
  }

  async get(id, projectId) {
    const rows = await Connector.findAll({ where: { id, project_id: projectId } });
    if (!rows.length) throw fail(404, 'connector not found');
    return this.serialize(rows[0]);
  }

  async getByName(projectId, name) {
    const rows = await Connector.findAll({ where: { project_id: projectId, name } });
    if (!rows.length) throw fail(404, 'connector not found');
    return this.serialize(rows[0]);
  }

  async resolve(projectId, idOrName) {
    try { return await this.get(idOrName, projectId); } catch (e) {
      if (e.status !== 404) throw e;
      return this.getByName(projectId, idOrName);
    }
  }

  async update(id, projectId, body = {}) {
    const cur = await this.get(id, projectId);
    const patch = {};
    if (body.secret_ref != null) patch.secret_ref = String(body.secret_ref);
    if (body.status != null) patch.status = String(body.status);
    if (body.scopes != null) patch.scopes = JSON.stringify(body.scopes);
    if (body.options != null) patch.options = JSON.stringify(body.options);
    if (body.secret_ref && !body.status) patch.status = 'connected';
    await Connector.update(cur.id, patch);
    return this.get(cur.id, projectId);
  }

  async del(id, projectId) {
    await this.get(id, projectId);
    await Connector.delete(id);
    return { deleted: true };
  }

  async invoke(projectId, body, { audit } = {}) {
    const name = body.connector || body.name;
    if (!name) throw fail(400, 'connector name required');
    const conn = await this.resolve(projectId, name);
    if (conn.status === 'needs_auth' || conn.status === 'expired') {
      const e = fail(409, `reconnect ${conn.kind}`, 'oauth_reconnect');
      e.ask = {
        text: `Reconnect ${conn.kind} connector "${conn.name}"`,
        options: [`Reconnect ${conn.kind}`, 'Cancel', 'Other'],
        recommended: `Reconnect ${conn.kind}`,
      };
      throw e;
    }
    const kind = getKind(conn.kind);
    const tool = String(body.tool || body.action || 'request');
    const spec = (kind.tools || []).find((t) => t.name === tool);
    const method = String(body.args?.method || body.method || 'GET').toUpperCase();
    const isWrite = spec ? !!spec.write : !['GET', 'HEAD'].includes(method);
    if (typeof audit === 'function') {
      await audit({ kind: 'connector.invoke', tool, meta: { connector: conn.name, write: isWrite } });
    }
    const url = conn.options?.endpoint || body.args?.url;
    if (conn.kind === 'generic-http' && url) {
      const res = await fetch(url, {
        method,
        headers: body.args?.headers || { 'content-type': 'application/json' },
        body: method === 'GET' ? undefined : JSON.stringify(body.args?.body || {}),
      });
      const text = await res.text();
      return { ok: res.ok, status: res.status, body: text.slice(0, 8000), write: isWrite, connector: conn.name };
    }
    if (conn.kind === 'generic-mcp') {
      try {
        const { proxy } = require('../../../shared/conductorProxy');
        const toolId = body.args?.tool_id || body.args?.id || tool;
        const res = await proxy('POST', `/api/services/mcp_manager/api/v1/tools/${encodeURIComponent(toolId)}/invoke`, {
          projectId, timeout: 15000, data: { project_id: projectId, ...(body.args || {}) },
        });
        return { ok: (res.status || 200) < 400, status: res.status, body: res.data, write: isWrite, connector: conn.name };
      } catch (e) {
        return { ok: false, error: e.message, connector: conn.name, kind: conn.kind, tool };
      }
    }
    const e = fail(409, `${conn.kind} needs a live adapter or secret`, 'needs_adapter');
    e.ask = {
      text: `Configure ${conn.kind} connector "${conn.name}" (OAuth or API key). Fake success is not returned.`,
      options: [`Reconnect ${conn.kind}`, 'Cancel', 'Other'],
      recommended: `Reconnect ${conn.kind}`,
    };
    throw e;
  }
}

module.exports = { ConnectorService };
