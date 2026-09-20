const { MemoryStoreConfig } = require('../models');
const { MemoryDbClient } = require('./MemoryDbClient');

const STORE_SUFFIXES = {
  stMeta: '-memory-st-meta',
  stVectors: '-memory-st-vectors',
  ltMeta: '-memory-lt-meta',
  ltVectors: '-memory-lt-vectors',
};

function parseConfig(row) {
  if (!row) return null;
  const out = { ...row };
  for (const key of ['options', 'store_arns']) {
    if (typeof out[key] === 'string' && out[key]) {
      try { out[key] = JSON.parse(out[key]); } catch { /* keep string */ }
    }
  }
  return out;
}

class MemoryStoreService {
  constructor(dbClient = new MemoryDbClient()) {
    this.M = MemoryStoreConfig;
    this.db = dbClient;
  }

  assertProject(projectId) {
    if (!projectId) {
      const e = new Error('project_id is required');
      e.status = 400;
      throw e;
    }
  }

  async getConfig(projectId, name) {
    this.assertProject(projectId);
    const rows = await this.M.findAll({ where: { project_id: projectId } });
    if (!rows.length) return null;
    const want = name ? String(name).trim() : 'default';
    const hit = rows.find((r) => (r.name || 'default') === want);
    if (hit) return parseConfig(hit);
    if (name) return null;
    return parseConfig(rows[0]);
  }

  async list(projectId) {
    this.assertProject(projectId);
    const rows = await this.M.findAll({ where: { project_id: projectId } });
    return rows.map((row) => {
      const parsed = parseConfig(row);
      const storeName = parsed.name || 'default';
      return {
        ...parsed,
        name: storeName,
        arn: parsed.arn || `arn:aerekos:${projectId}:ai:memory:store/${storeName}`,
      };
    });
  }

  async get(id, projectId) {
    this.assertProject(projectId);
    const rows = await this.M.findAll({ where: { id, project_id: projectId } });
    if (!rows.length) {
      const e = new Error('memory store not found');
      e.status = 404;
      throw e;
    }
    const parsed = parseConfig(rows[0]);
    const storeName = parsed.name || 'default';
    return {
      ...parsed,
      name: storeName,
      arn: parsed.arn || `arn:aerekos:${projectId}:ai:memory:store/${storeName}`,
    };
  }

  async listReadyConfigs() {
    const rows = await this.M.findAll({ where: { status: 'ready' } });
    return rows.map(parseConfig).filter(Boolean);
  }

  async upsertConfig(projectId, body) {
    this.assertProject(projectId);
    const name = String(body.name || 'default').trim();
    const prefix = String(body.store_name_prefix || (name === 'default' ? 'memory' : `memory-${name}`)).trim();
    const payload = {
      project_id: projectId,
      name,
      data_worker_id: body.data_worker_id || '',
      embeddings_integration: body.embeddings_integration || '',
      extractor_integration: body.extractor_integration || '',
      store_name_prefix: prefix,
      window_size: String(body.window_size || 200),
      importance_threshold: String(body.importance_threshold ?? 0.6),
      ingest_rpm_per_session: String(body.ingest_rpm_per_session || 120),
      ingest_rpm_per_user: String(body.ingest_rpm_per_user || 300),
      status: body.status || 'draft',
      options: JSON.stringify(body.options || {}),
      arn: `arn:aerekos:${projectId}:ai:memory:store/${name}`,
    };

    const existing = await this.getConfig(projectId, name);
    if (existing) {
      return parseConfig(await this.M.update(existing.id, payload));
    }
    return parseConfig(await this.M.create(payload));
  }

  storeNames(prefix) {
    return {
      stMeta: `${prefix}${STORE_SUFFIXES.stMeta}`,
      stVectors: `${prefix}${STORE_SUFFIXES.stVectors}`,
      ltMeta: `${prefix}${STORE_SUFFIXES.ltMeta}`,
      ltVectors: `${prefix}${STORE_SUFFIXES.ltVectors}`,
    };
  }

  async provision(projectId, storeName) {
    const config = await this.getConfig(projectId, storeName);
    if (!config || !config.store_name_prefix) {
      const e = new Error('memory_config_required');
      e.status = 400;
      e.code = 'memory_config_required';
      throw e;
    }
    if (!config.data_worker_id) {
      const e = new Error('data_worker_id required in memory config');
      e.status = 400;
      throw e;
    }

    const names = this.storeNames(config.store_name_prefix);
    const workerId = config.data_worker_id;
    const created = {};

    for (const [key, name] of Object.entries(names)) {
      const type = key.includes('Vectors') ? 'lancedb' : 'sqlite3';
      try {
        created[key] = await this.db.createDatabase(projectId, name, type, workerId);
      } catch (err) {
        const exists = err.response?.status === 409 || String(err.message || '').includes('already exists');
        if (!exists) throw err;
        created[key] = { name, type, status: 'running' };
      }
      if (type === 'sqlite3') {
        await this.db.memorySchema(projectId, name);
      }
    }

    for (const key of ['stMeta', 'ltMeta']) {
      await this.db.memorySchema(projectId, names[key]);
    }

    const storeArns = Object.fromEntries(
      Object.entries(names).map(([k, n]) => [k, `arn:aerekos:${projectId}:db:database/${n}`])
    );

    const updated = await this.M.update((await this.getConfig(projectId, storeName)).id, {
      status: 'ready',
      store_arns: JSON.stringify(storeArns),
    });

    return { config: parseConfig(updated), stores: names, created };
  }

  async status(projectId, storeName) {
    const config = await this.getConfig(projectId, storeName);
    if (!config) return { configured: false, status: 'unconfigured' };
    const names = config.store_name_prefix ? this.storeNames(config.store_name_prefix) : {};
    const store = config.name || 'default';
    return {
      configured: true,
      name: store,
      arn: config.arn || `arn:aerekos:${projectId}:ai:memory:store/${store}`,
      status: config.status || 'draft',
      store_name_prefix: config.store_name_prefix,
      stores: names,
      store_arns: config.store_arns || {},
      embeddings_integration: config.embeddings_integration,
      extractor_integration: config.extractor_integration,
    };
  }
}

module.exports = { MemoryStoreService, STORE_SUFFIXES };
