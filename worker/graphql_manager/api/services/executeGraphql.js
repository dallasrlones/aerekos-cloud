'use strict';

const { fail } = require('../../../shared/crudCore');
const { proxy } = require('../../../shared/conductorProxy');
const { compileSchema, cap } = require('./compileSchema');

function stripIgnored(q) {
  return String(q || '').replace(/#[^\n]*/g, '').trim();
}

function parseArgs(raw, variables) {
  const out = {};
  if (!raw) return out;
  const re = /(\w+)\s*:\s*(\$[A-Za-z_]\w*|"[^"]*"|'[^']*'|true|false|null|-?\d+(?:\.\d+)?)/g;
  let m;
  while ((m = re.exec(raw))) {
    let v = m[2];
    if (v.startsWith('$')) v = (variables || {})[v.slice(1)];
    else if (v === 'true') v = true;
    else if (v === 'false') v = false;
    else if (v === 'null') v = null;
    else if (!/^['"]/.test(v) && v !== '' && !Number.isNaN(Number(v))) v = Number(v);
    else v = String(v).replace(/^['"]|['"]$/g, '');
    out[m[1]] = v;
  }
  return out;
}

function firstSelection(query, variables) {
  const q = stripIgnored(query);
  if (!q) throw fail(400, 'query required');
  const mutation = /^mutation\b/i.test(q);
  const body = q.replace(/^(query|mutation)\s*[A-Za-z_]\w*\s*(\([^)]*\))?\s*/i, '');
  const m = body.match(/\{\s*([A-Za-z_]\w*)\s*(?:\(([^)]*)\))?/);
  if (!m) throw fail(400, 'could not parse GraphQL selection');
  return { mutation, field: m[1], args: parseArgs(m[2], variables || {}) };
}

function modelFromField(field) {
  if (/^create/i.test(field) || /^update/i.test(field)) {
    return cap(field.replace(/^(create|update)/i, ''));
  }
  const c = cap(field);
  if (/ies$/i.test(c)) return `${c.slice(0, -3)}y`;
  if (/s$/i.test(c) && !/ss$/i.test(c)) return c.slice(0, -1);
  return c;
}

function isListField(field) {
  if (/^(create|update)/i.test(field)) return false;
  return /s$/i.test(field) && !/ss$/i.test(field);
}

async function dataApi(method, app, model, { projectId, id, body } = {}) {
  let path = `/api/services/api_manager/api/v1/data/${encodeURIComponent(app)}/${encodeURIComponent(model)}`;
  if (id) path += `/${encodeURIComponent(id)}`;
  if (method === 'GET') path += `?project_id=${encodeURIComponent(projectId)}`;
  const res = await proxy(method, path, {
    projectId,
    data: method === 'GET' ? undefined : { project_id: projectId, ...(body || {}) },
  });
  if (res.status >= 400) {
    throw fail(res.status, res.data?.error?.message || `Data API ${res.status}`);
  }
  return res.data;
}

async function executeGraphql({ service, project_id, name, query, variables, models } = {}) {
  if (!project_id) throw fail(400, 'project_id required');
  if (!query) throw fail(400, 'query required');
  const apiName = String(name || 'app');
  let item = null;
  const existing = await service.list(project_id);
  item = existing.find((i) => i.name === apiName) || null;
  let schema = item?.schema || '';
  if (!schema && models) {
    schema = compileSchema(models);
    if (item) await service.update(item.id, project_id, { schema, data_app: item.data_app || apiName });
    else item = await service.create({ project_id, name: apiName, schema, data_app: apiName });
  }
  if (!item) throw fail(404, `graphql api not found: ${apiName}`);
  const app = item.data_app || item.name || apiName;
  const sel = firstSelection(query, variables);
  const model = modelFromField(sel.field);
  const args = { ...variables, ...sel.args };

  if (sel.mutation) {
    if (/^create/i.test(sel.field)) {
      const created = await dataApi('POST', app, model, { projectId: project_id, body: args });
      return { data: { [sel.field]: created.item || created }, schema };
    }
    if (/^update/i.test(sel.field)) {
      const id = args.id;
      if (!id) throw fail(400, 'id required');
      const patch = { ...args };
      delete patch.id;
      const updated = await dataApi('PATCH', app, model, { projectId: project_id, id, body: patch });
      return { data: { [sel.field]: updated.item || updated }, schema };
    }
    throw fail(400, `unsupported mutation ${sel.field}`);
  }

  if (args.id || !isListField(sel.field)) {
    const id = args.id;
    if (!id) throw fail(400, 'id required');
    const one = await dataApi('GET', app, model, { projectId: project_id, id });
    return { data: { [sel.field]: one.item || one }, schema };
  }
  const list = await dataApi('GET', app, model, { projectId: project_id });
  return { data: { [sel.field]: list.items || list }, schema };
}

module.exports = { executeGraphql, firstSelection, modelFromField };
