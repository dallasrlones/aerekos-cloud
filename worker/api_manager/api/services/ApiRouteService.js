const { ApiRoute } = require('../models');
const { matchPath, fillTemplate, buildPublicUrl } = require('../../../shared/routeTemplate');

function prettyBase() {
  return (process.env.PUBLIC_API_URL || process.env.CONDUCTOR_PUBLIC_URL || '').replace(/\/$/, '');
}

function serialize(row) {
  if (!row) return row;
  const o = typeof row.toJSON === 'function' ? row.toJSON() : { ...row };
  const params = { project_id: o.project_id };
  o.pretty_invoke_url = o.public_path
    ? buildPublicUrl(prettyBase() || 'https://cloudapi.aerekos.com', o.public_path, params)
    : null;
  return o;
}

class ApiRouteService {
  constructor() { this.M = ApiRoute; }
  assertP(p) { if (!p||!String(p).trim()){const e=new Error('project_id required');e.status=400;throw e;} }
  async create(body) {
    this.assertP(body.project_id);
    const name = String(body.name||'').trim();
    if (!name) { const e = new Error('name required'); e.status=400; throw e; }
    const d = await this.M.findAll({ where: { project_id: body.project_id, name } });
    if (d.length) { const e = new Error('name taken'); e.status=409; throw e; }
    return serialize(await this.M.create(body));
  }
  async list(projectId) { this.assertP(projectId); return (await this.M.findAll({ where: { project_id: projectId } })).map(serialize); }
  async get(id, projectId) { this.assertP(projectId); const r = await this.M.findAll({ where: { id, project_id: projectId } }); if (!r.length){const e=new Error('Not found');e.status=404;throw e;} return serialize(r[0]); }
  async update(id, projectId, body) {
    await this.get(id, projectId);
    const patch = { ...(body || {}) };
    delete patch.id; delete patch.project_id; delete patch.created_at; delete patch.updated_at;
    if (patch.name !== undefined) {
      const name = String(patch.name || '').trim();
      if (!name) { const e = new Error('name required'); e.status = 400; throw e; }
      const dup = await this.M.findAll({ where: { project_id: projectId, name } });
      if (dup.some((d) => String(d.id) !== String(id))) { const e = new Error('name taken'); e.status = 409; throw e; }
      patch.name = name;
    }
    if (Object.keys(patch).length) await this.M.update(id, patch);
    return this.get(id, projectId);
  }
  async del(id, projectId) { await this.get(id, projectId); await this.M.delete(id); return { deleted:true, id }; }

  async seedPresets(projectId) {
    this.assertP(projectId);
    const { listPresets } = require('../../../shared/gatewayPresets');
    const created = [];
    const updated = [];
    for (const preset of listPresets()) {
      const existing = await this.M.findAll({ where: { project_id: projectId, name: preset.name } });
      const row = {
        project_id: projectId,
        name: preset.name,
        method: preset.method,
        public_path: preset.public_path,
        backend_url: `${preset.target_service}:${preset.target_path}#${preset.required_scope || ''}`,
        target_service: preset.target_service,
        target_path: preset.target_path,
        resource_arn_template: preset.resource_arn_template || '',
        required_scope: preset.required_scope || '',
        resolve_arn_at: preset.resolve_arn_at || '',
        enabled: 1,
        desired: 1,
      };
      if (existing.length) {
        await this.M.update(existing[0].id, row);
        updated.push(preset.name);
      } else {
        await this.M.create(row);
        created.push(preset.name);
      }
    }
    return { created, updated };
  }

  async match({ method, path, project_id: projectId, ip } = {}) {
    const verb = String(method || 'GET').toUpperCase();
    const p = String(path || '');
    let rows = [];
    if (projectId) {
      rows = await this.M.findAll({ where: { project_id: projectId } });
    } else {
      rows = await this.M.findAll();
    }
    for (const row of rows) {
      if (String(row.method || '').toUpperCase() !== verb) continue;
      const hit = matchPath(row.public_path, p);
      if (!hit) continue;
      const params = hit.params || {};
      const pid = params.project_id || row.project_id;
      const resource_arn = row.resource_arn_template
        ? fillTemplate(row.resource_arn_template, { ...params, project_id: pid })
        : '';
      const target_path = fillTemplate(row.target_path || '', params);
      const match = {
        id: row.id,
        name: row.name,
        method: row.method,
        public_path: row.public_path,
        target_service: row.target_service,
        target_path,
        resource_arn_template: row.resource_arn_template,
        resource_arn,
        required_scope: row.required_scope,
        resolve_arn_at: row.resolve_arn_at || '',
        project_id: pid,
        params,
        desired: row.desired || 1,
      };
      const waf = await this.evaluateWaf(pid, { ip, path: p });
      if (waf?.action === 'block') {
        const e = new Error('blocked by waf');
        e.status = 403;
        e.waf = waf;
        throw e;
      }
      return { match, waf };
    }
    return { match: null };
  }

  async evaluateWaf(projectId, { ip, path } = {}) {
    if (process.env.SKIP_WAF === '1' || process.env.SKIP_WAF === 'true') {
      return { action: 'allow', skipped: true };
    }
    const conductor = process.env.CONDUCTOR_URL;
    const token = process.env.CONDUCTOR_TOKEN || process.env.SERVICE_TOKEN;
    if (!conductor || !token) return { action: 'allow', skipped: true, reason: 'no_conductor' };
    try {
      const axios = require('axios');
      const res = await axios.post(
        `${conductor.replace(/\/$/, '')}/api/services/waf_manager/api/v1/evaluate`,
        { project_id: projectId, ip: ip || '', path: path || '/' },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 3000 },
      );
      return res.data || { action: 'allow' };
    } catch {
      return { action: 'allow', skipped: true, reason: 'waf_unreachable' };
    }
  }

  async scale(id, projectId, desired) {
    const n = Math.max(0, parseInt(desired, 10) || 0);
    await this.update(id, projectId, { desired: n });
    return this.get(id, projectId);
  }
}
module.exports = { ApiRouteService };
