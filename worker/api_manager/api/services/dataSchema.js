'use strict';

/** Engines db_manager can provision; sqlite3 is the always-on homelab default. */
const ENGINES = ['sqlite3', 'postgresql', 'mongodb', 'mysql', 'neo4j', 'redis', 'elasticsearch', 'lancedb'];

function normalizeEngine(raw) {
  const e = String(raw || 'sqlite3').toLowerCase().trim();
  if (e === 'sqlite' || e === 'sqlite3') return 'sqlite3';
  if (e === 'postgres' || e === 'pg' || e === 'postgresql') return 'postgresql';
  if (e === 'mongo' || e === 'mongodb') return 'mongodb';
  if (e === 'mysql' || e === 'mariadb') return 'mysql';
  return ENGINES.includes(e) ? e : 'sqlite3';
}

function singular(name) {
  const n = String(name || '').trim();
  if (!n) return n;
  if (/ies$/i.test(n)) return n.slice(0, -3) + 'y';
  if (/ses$/i.test(n)) return n.slice(0, -2);
  if (/s$/i.test(n) && !/ss$/i.test(n)) return n.slice(0, -1);
  return n;
}

function collectionName(modelName) {
  const n = String(modelName || '').trim();
  if (!n) return n;
  const base = n.charAt(0).toLowerCase() + n.slice(1);
  if (/s$/i.test(base)) return base;
  if (/y$/i.test(base) && !/[aeiou]y$/i.test(base)) return `${base.slice(0, -1)}ies`;
  return `${base}s`;
}

function fkField(relName) {
  const s = singular(relName);
  if (!s) return 'parent_id';
  return `${s.charAt(0).toLowerCase()}${s.slice(1)}_id`;
}

function cap(n) {
  const s = singular(String(n || ''));
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function resolveModelName(models, raw) {
  if (!raw) return null;
  if (models[raw]) return raw;
  const c = cap(raw);
  if (models[c]) return c;
  const lower = String(raw).toLowerCase();
  return Object.keys(models).find((k) => k.toLowerCase() === lower || collectionName(k) === lower) || null;
}

function compileSettings(modelName, def) {
  const settings = { ...(def.settings || {}) };
  const indexes = new Set([...(settings.indexes || [])]);
  if (settings.indexes === false) {
    settings.indexes = [];
    return settings;
  }
  for (const rel of settings.belongsTo || []) {
    indexes.add(fkField(rel));
  }
  if (def.fields && def.fields.owner_id) indexes.add('owner_id');
  if (def.fields && def.fields.project_id) indexes.add('project_id');
  if (settings.timestamps) {
    indexes.add('created_at');
    indexes.add('updated_at');
  }
  for (const extra of settings.compound_indexes || []) {
    if (typeof extra === 'string') indexes.add(extra);
  }
  settings.indexes = [...indexes];
  return settings;
}

function asList(v) {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function injectRelationshipFields(models) {
  const out = {};
  for (const [name, def] of Object.entries(models || {})) {
    const fields = { ...(def.fields || {}) };
    const settings = { ...(def.settings || {}) };
    settings.belongsTo = asList(settings.belongsTo);
    settings.hasMany = asList(settings.hasMany);
    settings.hasOne = asList(settings.hasOne);
    settings.unique = asList(settings.unique);
    settings.required = asList(settings.required);
    for (const rel of settings.belongsTo) {
      const fk = fkField(rel);
      if (!fields[fk]) fields[fk] = 'string';
    }
    if (!fields.project_id) fields.project_id = 'string';
    out[name] = { ...def, fields, settings: compileSettings(name, { ...def, fields, settings }) };
  }
  return out;
}

function tableName(app, model, projectId) {
  const pid = String(projectId || 'local').replace(/\W/g, '_').slice(0, 12);
  return `da_${pid}_${String(app).replace(/\W/g, '_')}_${String(model).replace(/\W/g, '_')}`;
}

function publicCollectionPath(app, modelName) {
  return `/v1/projects/{project_id}/data/${encodeURIComponent(app)}/${collectionName(modelName)}`;
}

function describeEndpoints(app, models) {
  const endpoints = [];
  for (const [modelName, def] of Object.entries(models || {})) {
    const col = collectionName(modelName);
    const base = `/data/${app}/${modelName}`;
    const pretty = `/v1/projects/{project_id}/data/${app}/${col}`;
    endpoints.push({ method: 'GET', path: base, pretty, action: 'list', model: modelName });
    endpoints.push({ method: 'POST', path: base, pretty, action: 'create', model: modelName });
    endpoints.push({ method: 'GET', path: `${base}/:id`, pretty: `${pretty}/{id}`, action: 'get', model: modelName });
    endpoints.push({ method: 'PATCH', path: `${base}/:id`, pretty: `${pretty}/{id}`, action: 'update', model: modelName });
    endpoints.push({ method: 'DELETE', path: `${base}/:id`, pretty: `${pretty}/{id}`, action: 'delete', model: modelName });
    for (const child of def.settings?.hasMany || []) {
      const childName = resolveModelName(models, child) || cap(child);
      const childCol = collectionName(childName);
      endpoints.push({
        method: 'GET',
        path: `/data/${app}/${modelName}/:id/${childCol}`,
        pretty: `${pretty}/{id}/${childCol}`,
        action: 'list_nested',
        model: childName,
        parent: modelName,
      });
      endpoints.push({
        method: 'POST',
        path: `/data/${app}/${modelName}/:id/${childCol}`,
        pretty: `${pretty}/{id}/${childCol}`,
        action: 'create_nested',
        model: childName,
        parent: modelName,
      });
    }
  }
  return endpoints;
}

function defaultAutoscaling(raw) {
  const a = raw && typeof raw === 'object' ? raw : {};
  return {
    min: Math.max(1, parseInt(a.min ?? a.min_instances ?? 1, 10) || 1),
    max: Math.max(1, parseInt(a.max ?? a.max_instances ?? 4, 10) || 4),
    metric: a.metric || 'rps',
    target: Number(a.target ?? a.target_request_rate ?? 50) || 50,
    scale_up_cooldown: parseInt(a.scale_up_cooldown ?? 60, 10) || 60,
    scale_down_cooldown: parseInt(a.scale_down_cooldown ?? 300, 10) || 300,
  };
}

function compileDocument(doc = {}) {
  const name = String(doc.name || 'app').trim() || 'app';
  const engine = normalizeEngine(doc.engine || doc.database_engine || (doc.database && doc.database.engine));
  const database = String(doc.database?.name || doc.database || `${name}-db`).trim();
  const models = injectRelationshipFields(doc.models || {});
  const autoscaling = defaultAutoscaling(doc.autoscaling);
  const desired = Math.max(autoscaling.min, parseInt(doc.desired ?? autoscaling.min, 10) || autoscaling.min);
  const schema = {
    name,
    engine,
    database,
    auth: doc.auth !== false,
    public: doc.public === true,
    desired,
    autoscaling,
    models,
    routes: Array.isArray(doc.routes) ? doc.routes : [],
  };
  const compiled = Object.entries(models).map(([modelName, def]) => ({
    model: modelName,
    table: tableName(name, modelName, doc.project_id),
    collection: collectionName(modelName),
    indexes: def.settings.indexes || [],
    belongsTo: def.settings.belongsTo || [],
    hasMany: def.settings.hasMany || [],
    unique: def.settings.unique || [],
  }));
  return { schema, compiled, endpoints: describeEndpoints(name, models) };
}

module.exports = {
  ENGINES,
  normalizeEngine,
  singular,
  collectionName,
  fkField,
  cap,
  resolveModelName,
  compileSettings,
  injectRelationshipFields,
  tableName,
  publicCollectionPath,
  describeEndpoints,
  defaultAutoscaling,
  compileDocument,
};
