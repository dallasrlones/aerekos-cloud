'use strict';

const axios = require('axios');
const { DataApi, ApiRoute } = require('../models');

function fail(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}
const {
  compileDocument,
  tableName,
  collectionName,
  fkField,
  resolveModelName,
  cap,
  normalizeEngine,
} = require('./dataSchema');
const {
  provisionType,
  recordType,
  connectRemote,
  getCached,
  setCached,
  recordModelSettings,
  localSqlite,
} = require('./dataEngine');

const SKIP_INVOKE = process.env.SKIP_INVOKE === '1' || process.env.SKIP_INVOKE === 'true';
const SKIP_DB = process.env.SKIP_DB_PROVISION === '1' || process.env.SKIP_DB_PROVISION === 'true';

const modelCache = new Map();

function getModel(recordDb, projectId, app, modelName, def) {
  const engine = recordDb.engine || 'sqlite3';
  const key = `${projectId}:${app}:${engine}:${modelName}`;
  if (modelCache.has(key)) return modelCache.get(key);
  const fields = { ...(def.fields || {}) };
  if (!fields.project_id) fields.project_id = 'string';
  const M = recordDb.db.model(tableName(app, modelName, projectId), fields, recordModelSettings(def));
  modelCache.set(key, M);
  return M;
}

function dropAppCache(projectId, app) {
  const prefix = `${projectId}:${app}:`;
  for (const k of [...modelCache.keys()]) {
    if (k.startsWith(prefix) || k.includes(`:${app}:`)) {
      if (k.startsWith(`${projectId}:${app}:`)) modelCache.delete(k);
    }
  }
}

function parseWhere(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

function parseAutoscaling(row, schema) {
  if (row.autoscaling) {
    try { return JSON.parse(row.autoscaling); } catch { /* fall through */ }
  }
  return schema.autoscaling || { min: 1, max: 4, metric: 'rps', target: 50 };
}

function plain(row) {
  if (!row) return row;
  if (typeof row.toJSON === 'function') return { ...row.toJSON() };
  return { ...row };
}

class DataApiService {
  conductor() {
    return (process.env.CONDUCTOR_URL || process.env.CONDUCTOR_INTERNAL_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
  }

  token() {
    return process.env.CONDUCTOR_TOKEN || process.env.SERVICE_TOKEN || '';
  }

  headers(projectId) {
    const h = { 'Content-Type': 'application/json', 'x-project-id': projectId };
    const tok = this.token();
    if (tok) h.Authorization = `Bearer ${tok}`;
    return h;
  }

  async list(projectId) {
    if (!projectId) throw fail(400, 'project_id required');
    return (await DataApi.findAll({ where: { project_id: projectId } })).map((r) => this.serialize(r));
  }

  async getByName(projectId, name) {
    const rows = await DataApi.findAll({ where: { project_id: projectId, name } });
    if (!rows.length) throw fail(404, `data api not found: ${name}`);
    return rows[0];
  }

  parse(row) {
    try { return JSON.parse(row.schema_json || '{}'); } catch { return {}; }
  }

  serialize(row) {
    const schema = this.parse(row);
    return {
      ...row,
      schema,
      engine: row.engine || schema.engine || 'sqlite3',
      desired: Number(row.desired || schema.desired || 1),
      autoscaling: parseAutoscaling(row, schema),
      endpoints: schema.endpoints || [],
    };
  }

  async apply(projectId, doc) {
    if (!projectId) throw fail(400, 'project_id required');
    const { schema, compiled, endpoints } = compileDocument(doc);
    schema.endpoints = endpoints;
    dropAppCache(projectId, schema.name);
    const existing = await DataApi.findAll({ where: { project_id: projectId, name: schema.name } });
    const payload = {
      project_id: projectId,
      name: schema.name,
      database: schema.database,
      engine: schema.engine,
      auth: schema.auth ? 'true' : 'false',
      desired: schema.desired,
      autoscaling: JSON.stringify(schema.autoscaling),
      schema_json: JSON.stringify(schema),
    };
    let row;
    if (existing.length) {
      await DataApi.update(existing[0].id, payload);
      row = (await DataApi.findAll({ where: { id: existing[0].id } }))[0];
    } else {
      row = await DataApi.create(payload);
    }
    const database = await this.ensureDatabase(projectId, schema);
    const conn = await this.connectEngine(projectId, schema, database);
    for (const [modelName, def] of Object.entries(schema.models)) {
      getModel(conn, projectId, schema.name, modelName, def);
    }
    const routes = await this.seedGatewayRoutes(projectId, schema);
    await this.syncApiManagerScale(projectId, schema.desired, schema.autoscaling);
    await this.compileGraphql(projectId, schema);
    return {
      item: this.serialize(row),
      compiled,
      schema,
      endpoints,
      routes: routes.map((r) => r.name),
      database: {
        name: database.name,
        engine: database.engine,
        status: database.status,
        query_engine: conn.adapter,
        fallback: conn.fallback || false,
        note: database.note || conn.note,
        error: database.error,
      },
    };
  }

  async connectEngine(projectId, schema, database = {}) {
    const engine = normalizeEngine(schema.engine);
    const cached = getCached(projectId, schema);
    if (cached) return cached;
    if (SKIP_DB || engine === 'sqlite3' || !recordType(engine) || recordType(engine) === 'sqlite') {
      return setCached(projectId, schema, localSqlite());
    }
    try {
      const info = database.connection || await this.fetchConnection(projectId, schema.database);
      if (!info) {
        return setCached(projectId, schema, { ...localSqlite(), fallback: true, note: 'no connection from db_manager; querying sqlite3' });
      }
      return setCached(projectId, schema, connectRemote(engine, info));
    } catch (e) {
      return setCached(projectId, schema, { ...localSqlite(), fallback: true, note: e.message });
    }
  }

  async fetchConnection(projectId, name) {
    const base = this.conductor();
    const res = await axios.get(
      `${base}/api/services/db_manager/api/databases/${encodeURIComponent(name)}/connection`,
      { params: { project_id: projectId }, headers: this.headers(projectId), timeout: 10000, validateStatus: () => true },
    );
    if (res.status >= 400) return null;
    return res.data;
  }

  async ensureDatabase(projectId, schema) {
    const engine = normalizeEngine(schema.engine);
    const name = schema.database;
    const type = provisionType(engine);
    if (SKIP_DB || engine === 'sqlite3' || type === 'sqlite3') {
      return {
        name,
        engine,
        status: 'local',
        skipped: true,
        note: 'sqlite3 is hosted in api_manager. Other engines are provisioned via db_manager and queried through aerekos-record.',
      };
    }
    const base = this.conductor();
    const headers = this.headers(projectId);
    try {
      const listed = await axios.get(`${base}/api/services/db_manager/api/databases`, {
        params: { project_id: projectId }, headers, timeout: 10000, validateStatus: () => true,
      });
      const dbs = listed.data?.databases || listed.data?.items || [];
      const hit = (Array.isArray(dbs) ? dbs : []).find((d) => d.name === name);
      if (hit) {
        const connection = await this.fetchConnection(projectId, name);
        return { name, engine: hit.type || type, status: hit.status || 'exists', id: hit.id, connection };
      }
      const created = await axios.post(`${base}/api/services/db_manager/api/databases`, {
        name, type,
      }, { params: { project_id: projectId }, headers, timeout: 30000, validateStatus: () => true });
      if (created.status === 409) {
        const connection = await this.fetchConnection(projectId, name);
        return { name, engine: type, status: 'exists', connection };
      }
      if (created.status >= 400) {
        return { name, engine: type, status: 'error', error: created.data?.error?.message || `HTTP ${created.status}` };
      }
      const connection = await this.fetchConnection(projectId, name);
      return { name, engine: type, status: 'provisioned', id: created.data?.id, connection };
    } catch (e) {
      return { name, engine: type, status: 'error', error: e.message };
    }
  }

  async seedGatewayRoutes(projectId, schema) {
    const desired = Number(schema.desired || 1);
    const seeded = [];
    const specs = [];
    for (const [modelName, def] of Object.entries(schema.models || {})) {
      const col = collectionName(modelName);
      const itemPath = `/v1/projects/{project_id}/data/${schema.name}/${col}/{id}`;
      const collPath = `/v1/projects/{project_id}/data/${schema.name}/${col}`;
      const targetBase = `/api/v1/data/${schema.name}/${modelName}`;
      specs.push({ name: `data-${schema.name}-${col}-collection`, method: 'GET', public_path: collPath, target_path: targetBase, scope: 'Read' });
      specs.push({ name: `data-${schema.name}-${col}-create`, method: 'POST', public_path: collPath, target_path: targetBase, scope: 'Write' });
      specs.push({ name: `data-${schema.name}-${col}-item`, method: 'GET', public_path: itemPath, target_path: `${targetBase}/{id}`, scope: 'Read' });
      specs.push({ name: `data-${schema.name}-${col}-update`, method: 'PATCH', public_path: itemPath, target_path: `${targetBase}/{id}`, scope: 'Write' });
      specs.push({ name: `data-${schema.name}-${col}-delete`, method: 'DELETE', public_path: itemPath, target_path: `${targetBase}/{id}`, scope: 'Write' });
      for (const child of def.settings?.hasMany || []) {
        const childName = resolveModelName(schema.models, child) || cap(child);
        const childCol = collectionName(childName);
        specs.push({
          name: `data-${schema.name}-${col}-${childCol}`,
          method: 'GET',
          public_path: `${itemPath}/${childCol}`,
          target_path: `${targetBase}/{id}/${childCol}`,
          scope: 'Read',
        });
        specs.push({
          name: `data-${schema.name}-${col}-${childCol}-create`,
          method: 'POST',
          public_path: `${itemPath}/${childCol}`,
          target_path: `${targetBase}/{id}/${childCol}`,
          scope: 'Write',
        });
      }
    }
    for (const spec of specs) {
      const existing = await ApiRoute.findAll({ where: { project_id: projectId, name: spec.name } });
      const row = {
        project_id: projectId,
        name: spec.name,
        method: spec.method,
        public_path: spec.public_path,
        backend_url: `api_manager:${spec.target_path}#data:${schema.name}:${spec.scope}`,
        target_service: 'api_manager',
        target_path: spec.target_path,
        resource_arn_template: `arn:aerekos:{project_id}:data:${schema.name}:${spec.name}`,
        required_scope: schema.public ? '' : `data:${schema.name}:${spec.scope}`,
        enabled: 1,
        desired,
      };
      if (existing.length) {
        await ApiRoute.update(existing[0].id, row);
        seeded.push({ ...existing[0], name: spec.name });
      } else {
        seeded.push(await ApiRoute.create(row));
      }
    }
    return seeded;
  }

  async syncApiManagerScale(projectId, desired, autoscaling) {
    const base = this.conductor();
    const headers = this.headers(projectId);
    const min = autoscaling?.min || desired || 1;
    const max = autoscaling?.max || Math.max(min, 4);
    try {
      await axios.put(
        `${base}/api/projects/${encodeURIComponent(projectId)}/services/api_manager/scaling`,
        {
          min_instances: min,
          max_instances: max,
          target_request_rate: autoscaling?.target || 50,
          target_cpu: 70,
          target_memory: 80,
          scale_up_cooldown: autoscaling?.scale_up_cooldown || 60,
          scale_down_cooldown: autoscaling?.scale_down_cooldown || 300,
        },
        { headers, timeout: 8000, validateStatus: () => true },
      );
    } catch (_) { /* conductor may be down in unit tests */ }
  }

  async compileGraphql(projectId, schema) {
    const base = this.conductor();
    try {
      await axios.post(
        `${base}/api/services/graphql_manager/api/v1/compile`,
        { project_id: projectId, name: schema.name, models: schema.models },
        { headers: this.headers(projectId), timeout: 8000, validateStatus: () => true },
      );
    } catch (_) { /* optional */ }
  }

  async scale(projectId, name, desired) {
    const row = await this.getByName(projectId, name);
    const schema = this.parse(row);
    const auto = parseAutoscaling(row, schema);
    const n = Math.max(auto.min || 1, Math.min(auto.max || 10, parseInt(desired, 10) || 1));
    schema.desired = n;
    await DataApi.update(row.id, { desired: n, schema_json: JSON.stringify(schema) });
    const routes = await ApiRoute.findAll({ where: { project_id: projectId } });
    for (const r of routes.filter((x) => String(x.name || '').startsWith(`data-${name}-`))) {
      await ApiRoute.update(r.id, { desired: n });
    }
    await this.syncApiManagerScale(projectId, n, auto);
    return this.serialize(await this.getByName(projectId, name));
  }

  async evaluateAutoscaling(projectId, name, { rps, cpu } = {}) {
    const row = await this.getByName(projectId, name);
    const schema = this.parse(row);
    const auto = parseAutoscaling(row, schema);
    const current = Number(row.desired || schema.desired || auto.min || 1);
    const metric = Number(rps ?? cpu ?? 0);
    let next = current;
    let reason = 'within target';
    if (metric > auto.target && current < auto.max) {
      next = current + 1;
      reason = `${auto.metric || 'rps'} ${metric} > ${auto.target}`;
    } else if (metric < auto.target / 2 && current > auto.min) {
      next = current - 1;
      reason = `${auto.metric || 'rps'} ${metric} < ${auto.target / 2}`;
    }
    if (next !== current) await this.scale(projectId, name, next);
    return { name, current, desired: next, metric, reason, autoscaling: auto };
  }

  async ensureDefaults(projectId) {
    const items = await this.list(projectId);
    if (items.length) return { item: items[0], created: false };
    return this.apply(projectId, {
      name: 'app',
      engine: 'sqlite3',
      database: 'app-db',
      auth: true,
      desired: 1,
      autoscaling: { min: 1, max: 4, metric: 'rps', target: 50 },
      models: {
        User: {
          fields: { name: 'string', email: 'string', owner_id: 'string' },
          settings: { required: ['email'], unique: ['email'], hasMany: ['Post'], timestamps: true },
        },
        Post: {
          fields: { title: 'string', body: 'string' },
          settings: { belongsTo: ['User'], timestamps: true },
        },
      },
    });
  }

  async modelFor(projectId, app, modelName) {
    const row = await this.getByName(projectId, app);
    const schema = this.parse(row);
    const resolved = resolveModelName(schema.models || {}, modelName);
    if (!resolved) throw fail(404, `model not found: ${modelName}`);
    const def = schema.models[resolved];
    const conn = await this.connectEngine(projectId, schema);
    return { Model: getModel(conn, projectId, app, resolved, def), def, schema, modelName: resolved, row, conn };
  }

  async invokeHook(projectId, hook, event, { sync } = {}) {
    if (!hook || !hook.function) return event.record;
    if (SKIP_INVOKE) return { ...event.record, _hook: hook.function };
    const invocation_type = sync === false ? 'Event' : 'RequestResponse';
    try {
      const res = await axios.post(
        `${this.conductor()}/api/services/function_manager/api/v1/functions/${encodeURIComponent(hook.function)}/invoke`,
        { project_id: projectId, payload: event, invocation_type },
        { timeout: 15000, validateStatus: () => true, headers: this.headers(projectId) },
      );
      const body = res.data || {};
      if (sync !== false && body.record) return body.record;
      if (res.status >= 400 && sync !== false) throw fail(res.status, body.error?.message || 'hook aborted');
    } catch (e) {
      if (e.status) throw e;
      if (sync !== false) throw fail(502, e.message);
    }
    return event.record;
  }

  async createRecord(projectId, app, modelName, body, identity = {}) {
    const { Model, def, modelName: resolved } = await this.modelFor(projectId, app, modelName);
    const strip = { ...body };
    delete strip.project_id;
    let record = { ...strip, project_id: projectId };
    if (def.fields?.owner_id && identity.sub && !record.owner_id) record.owner_id = identity.sub;
    const before = def.hooks?.before_create;
    record = await this.invokeHook(projectId, before, { hook: 'before_create', model: resolved, record }, { sync: true });
    let saved;
    try {
      saved = await Model.create(record);
    } catch (e) {
      const msg = String(e.message || e);
      if (/UNIQUE|unique|constraint/i.test(msg)) throw fail(409, msg);
      throw e;
    }
    const after = def.hooks?.after_create;
    if (after) await this.invokeHook(projectId, after, { hook: 'after_create', model: resolved, record: saved }, { sync: false });
    return plain(saved);
  }

  async listRecords(projectId, app, modelName, query = {}) {
    const { Model, def, schema, modelName: resolved } = await this.modelFor(projectId, app, modelName);
    const where = { project_id: projectId, ...parseWhere(query.where) };
    let rows = await Model.findAll({ where });
    const order = query.order || (def.settings?.timestamps ? 'created_at' : null);
    if (order) {
      const dir = query.desc === '1' || query.desc === true || query.desc === 'true' ? -1 : 1;
      rows = [...rows].sort((a, b) => {
        const av = a[order]; const bv = b[order];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        if (av > bv) return dir;
        if (av < bv) return -dir;
        return 0;
      });
    }
    const offset = Math.max(0, parseInt(query.offset, 10) || 0);
    const limit = Math.min(500, Math.max(1, parseInt(query.limit, 10) || 100));
    rows = rows.slice(offset, offset + limit).map(plain);
    const include = String(query.include || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (include.length) {
      rows = await Promise.all(rows.map((r) => this.expandIncludes(projectId, app, schema, resolved, r, include)));
    }
    return rows;
  }

  async expandIncludes(projectId, app, schema, modelName, row, include) {
    const out = plain(row);
    const def = schema.models[modelName] || {};
    const hasMany = def.settings?.hasMany || [];
    const belongsTo = def.settings?.belongsTo || [];
    for (const raw of include) {
      const asHasMany = hasMany.find((h) => h.toLowerCase() === raw.toLowerCase() || collectionName(h) === raw.toLowerCase());
      const asBelongs = belongsTo.find((b) => b.toLowerCase() === raw.toLowerCase() || cap(b).toLowerCase() === cap(raw).toLowerCase());
      if (asHasMany) {
        const child = resolveModelName(schema.models, asHasMany);
        const fk = fkField(modelName);
        out[collectionName(child)] = await this.listRecords(projectId, app, child, { where: { [fk]: row.id }, limit: 200 });
      } else if (asBelongs) {
        const parent = resolveModelName(schema.models, asBelongs);
        const fk = fkField(parent);
        const id = row[fk];
        out[parent.charAt(0).toLowerCase() + parent.slice(1)] = id
          ? await this.getRecord(projectId, app, parent, id).catch(() => null)
          : null;
      }
    }
    return out;
  }

  async getRecord(projectId, app, modelName, id, query = {}) {
    const { Model, schema, modelName: resolved } = await this.modelFor(projectId, app, modelName);
    const r = await Model.findAll({ where: { id, project_id: projectId } });
    if (!r.length) throw fail(404, 'Not found');
    const include = String(query.include || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (include.length) return this.expandIncludes(projectId, app, schema, resolved, r[0], include);
    return plain(r[0]);
  }

  async updateRecord(projectId, app, modelName, id, body) {
    await this.getRecord(projectId, app, modelName, id);
    const { Model, def } = await this.modelFor(projectId, app, modelName);
    const patch = { ...body };
    delete patch.id;
    delete patch.project_id;
    const before = def.hooks?.before_update;
    const merged = await this.invokeHook(projectId, before, { hook: 'before_update', model: modelName, record: patch, existing: { id } }, { sync: true });
    await Model.update(id, merged && typeof merged === 'object' ? { ...patch, ...merged } : patch);
    const saved = await this.getRecord(projectId, app, modelName, id);
    const after = def.hooks?.after_update;
    if (after) await this.invokeHook(projectId, after, { hook: 'after_update', model: modelName, record: saved }, { sync: false });
    return saved;
  }

  async deleteRecord(projectId, app, modelName, id) {
    await this.getRecord(projectId, app, modelName, id);
    const { Model, def } = await this.modelFor(projectId, app, modelName);
    const before = def.hooks?.before_delete;
    if (before) await this.invokeHook(projectId, before, { hook: 'before_delete', model: modelName, record: { id } }, { sync: true });
    await Model.delete(id);
    return { deleted: true, id };
  }

  async listNested(projectId, app, parentModel, parentId, childRaw, query = {}) {
    const { schema } = await this.modelFor(projectId, app, parentModel);
    const parent = resolveModelName(schema.models, parentModel);
    const child = resolveModelName(schema.models, childRaw);
    if (!child) throw fail(404, `model not found: ${childRaw}`);
    await this.getRecord(projectId, app, parent, parentId);
    const fk = fkField(parent);
    return this.listRecords(projectId, app, child, { ...query, where: { [fk]: parentId, ...parseWhere(query.where) } });
  }

  async createNested(projectId, app, parentModel, parentId, childRaw, body, identity) {
    const { schema } = await this.modelFor(projectId, app, parentModel);
    const parent = resolveModelName(schema.models, parentModel);
    const child = resolveModelName(schema.models, childRaw);
    if (!child) throw fail(404, `model not found: ${childRaw}`);
    await this.getRecord(projectId, app, parent, parentId);
    const fk = fkField(parent);
    return this.createRecord(projectId, app, child, { ...body, [fk]: parentId }, identity);
  }
}

module.exports = { DataApiService, getModel };
