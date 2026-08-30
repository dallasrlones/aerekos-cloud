const express = require('express');
const { requireAuth } = require('../../../shared/authManagerClient');
const { requireResource } = require('../../../shared/requireResource');
const { getMemoryDbClient } = require('../services/MemoryDbClient');
const { MemoryStoreService } = require('../services/MemoryStoreService');
const { MemoryIngestService } = require('../services/MemoryIngestService');
const { MemoryRetrieveService } = require('../services/MemoryRetrieveService');
const { MemoryPromoteService } = require('../services/MemoryPromoteService');
const { buildIngestLimiter } = require('../services/MemoryRateLimit');
const axios = require('axios');

const r = express.Router();
const dbClient = getMemoryDbClient();
const storeService = new MemoryStoreService(dbClient);
const ingestService = new MemoryIngestService({ storeService, dbClient });
const retrieveService = new MemoryRetrieveService({ storeService, ingestService, dbClient });
const promoteService = new MemoryPromoteService({ storeService, ingestService, dbClient });
const ingestRateLimit = buildIngestLimiter((pid) => storeService.getConfig(pid));

r.use(requireAuth());

function projectId(req) {
  return req.query.project_id || req.body?.project_id;
}

function err(res, e, next) {
  if (e && e.status) return res.status(e.status).json({ error: { message: e.message, code: e.code } });
  return next(e);
}

r.get('/stores', requireResource({ requiredScope: 'ai:InvokeMemory' }), async (req, res, next) => {
  try {
    const pid = projectId(req);
    if (!pid) return res.status(400).json({ error: { message: 'project_id is required' } });
    res.json({ items: await storeService.list(pid) });
  } catch (e) { err(res, e, next); }
});

r.post('/stores', requireResource({ requiredScope: 'ai:AdminMemory' }), async (req, res, next) => {
  try {
    const pid = projectId(req);
    if (!pid) return res.status(400).json({ error: { message: 'project_id is required' } });
    const config = await storeService.upsertConfig(pid, req.body || {});
    res.status(201).json({ config });
  } catch (e) { err(res, e, next); }
});

r.post('/setup', requireResource({ requiredScope: 'ai:AdminMemory' }), async (req, res, next) => {
  try {
    const pid = projectId(req);
    if (!pid) return res.status(400).json({ error: { message: 'project_id is required' } });
    await storeService.upsertConfig(pid, { ...(req.body?.config || { store_name_prefix: 'memory' }), name: req.body?.name || req.body?.config?.name });
    try {
      return res.json(await storeService.provision(pid, req.body?.name || req.body?.config?.name));
    } catch (e) {
      if (e.code === 'memory_config_required' || /data_worker_id/i.test(e.message || '')) {
        return res.json(await storeService.status(pid));
      }
      throw e;
    }
  } catch (e) { err(res, e, next); }
});

r.get('/status', requireResource({ requiredScope: 'ai:InvokeMemory' }), async (req, res, next) => {
  try {
    const pid = projectId(req);
    if (!pid) return res.status(400).json({ error: { message: 'project_id is required' } });
    res.json(await storeService.status(pid, req.query.name));
  } catch (e) { err(res, e, next); }
});

r.put('/config', requireResource({ requiredScope: 'ai:AdminMemory' }), async (req, res, next) => {
  try {
    const pid = projectId(req);
    if (!pid) return res.status(400).json({ error: { message: 'project_id is required' } });
    res.json({ config: await storeService.upsertConfig(pid, req.body || {}) });
  } catch (e) { err(res, e, next); }
});

r.post('/ingest', requireResource({ requiredScope: 'ai:InvokeMemory' }), ingestRateLimit, async (req, res, next) => {
  try {
    const pid = projectId(req);
    if (!pid) return res.status(400).json({ error: { message: 'project_id is required' } });
    res.json(await ingestService.ingest(pid, req.body));
  } catch (e) { err(res, e, next); }
});

r.post('/search', requireResource({ requiredScope: 'ai:InvokeMemory' }), async (req, res, next) => {
  try {
    const pid = projectId(req);
    if (!pid) return res.status(400).json({ error: { message: 'project_id is required' } });
    res.json(await retrieveService.retrieve(pid, req.body));
  } catch (e) { err(res, e, next); }
});

r.delete('/sessions/:sessionId', requireResource({ requiredScope: 'ai:AdminMemory' }), async (req, res, next) => {
  try {
    const pid = projectId(req);
    if (!pid) return res.status(400).json({ error: { message: 'project_id is required' } });
    const config = await storeService.getConfig(pid);
    if (!config?.store_name_prefix) return res.status(404).json({ error: { message: 'memory not configured' } });
    const names = storeService.storeNames(config.store_name_prefix);
    const sid = req.params.sessionId;
    await ingestService.db.memorySql(pid, names.stMeta, {
      op: 'exec',
      sql: 'DELETE FROM st_messages WHERE session_id = ?',
      params: [sid],
    });
    await ingestService.db.memorySql(pid, names.stMeta, {
      op: 'exec',
      sql: 'DELETE FROM st_chunks WHERE session_id = ?',
      params: [sid],
    });
    await ingestService.db.vectorDelete(pid, names.stVectors, { filter: { session_id: sid } });
    res.json({ deleted: true, session_id: sid });
  } catch (e) { err(res, e, next); }
});

r.post('/promote', requireResource({ requiredScope: 'ai:AdminMemory' }), async (req, res, next) => {
  try {
    const pid = projectId(req);
    if (!pid) return res.status(400).json({ error: { message: 'project_id is required' } });
    res.json(await promoteService.promote(pid, req.body || {}));
  } catch (e) { err(res, e, next); }
});

r.post('/backfill', requireResource({ requiredScope: 'ai:AdminMemory' }), async (req, res, next) => {
  try {
    const pid = projectId(req);
    if (!pid) return res.status(400).json({ error: { message: 'project_id is required' } });
    res.json(await promoteService.backfill(pid, req.body || {}));
  } catch (e) { err(res, e, next); }
});

r.post('/backup', requireResource({ requiredScope: 'ai:AdminMemory' }), async (req, res, next) => {
  try {
    const pid = projectId(req);
    if (!pid) return res.status(400).json({ error: { message: 'project_id is required' } });
    const config = await storeService.getConfig(pid);
    if (!config?.store_name_prefix) return res.status(404).json({ error: { message: 'memory not configured' } });
    const names = storeService.storeNames(config.store_name_prefix);
    const conductorUrl = (process.env.CONDUCTOR_URL || '').replace(/\/$/, '');
    const token = process.env.SERVICE_TOKEN || '';
    if (!conductorUrl) {
      const e = new Error('CONDUCTOR_URL required for backup');
      e.status = 503;
      throw e;
    }
    const backups = {};
    for (const [key, dbName] of Object.entries(names)) {
      const url = `${conductorUrl}/api/services/db_manager/api/databases/${encodeURIComponent(dbName)}/backups?project_id=${encodeURIComponent(pid)}`;
      const { data } = await axios.post(url, { backup_type: 'full' }, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      backups[key] = data?.backup || data;
    }
    res.json({ ok: true, backups });
  } catch (e) { err(res, e, next); }
});

r.post('/restore', requireResource({ requiredScope: 'ai:AdminMemory' }), async (req, res, next) => {
  try {
    const pid = projectId(req);
    if (!pid) return res.status(400).json({ error: { message: 'project_id is required' } });
    const { backups } = req.body || {};
    if (!backups || typeof backups !== 'object') {
      return res.status(400).json({ error: { message: 'backups object required (stMeta, stVectors, ltMeta, ltVectors → backup_id)' } });
    }
    const config = await storeService.getConfig(pid);
    if (!config?.store_name_prefix) return res.status(404).json({ error: { message: 'memory not configured' } });
    const names = storeService.storeNames(config.store_name_prefix);
    const conductorUrl = (process.env.CONDUCTOR_URL || '').replace(/\/$/, '');
    const token = process.env.SERVICE_TOKEN || '';
    if (!conductorUrl) {
      const e = new Error('CONDUCTOR_URL required for restore');
      e.status = 503;
      throw e;
    }
    const restored = {};
    for (const [key, dbName] of Object.entries(names)) {
      const backupId = backups[key];
      if (!backupId) continue;
      const url = `${conductorUrl}/api/services/db_manager/api/databases/${encodeURIComponent(dbName)}/backups/${encodeURIComponent(backupId)}/restore?project_id=${encodeURIComponent(pid)}`;
      const { data } = await axios.post(url, {}, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      restored[key] = data?.result || data;
    }
    res.json({ ok: true, restored });
  } catch (e) { err(res, e, next); }
});

r.delete('/users/:userId', requireResource({ requiredScope: 'ai:AdminMemory' }), async (req, res, next) => {
  try {
    const pid = projectId(req);
    if (!pid) return res.status(400).json({ error: { message: 'project_id is required' } });
    const config = await storeService.getConfig(pid);
    if (!config?.store_name_prefix) return res.status(404).json({ error: { message: 'memory not configured' } });
    const names = storeService.storeNames(config.store_name_prefix);
    const uid = req.params.userId;
    for (const table of ['st_messages', 'st_chunks', 'memory_sessions']) {
      await ingestService.db.memorySql(pid, names.stMeta, {
        op: 'exec',
        sql: `DELETE FROM ${table} WHERE user_id = ?`,
        params: [uid],
      });
    }
    for (const table of ['lt_summaries', 'lt_facts']) {
      await ingestService.db.memorySql(pid, names.ltMeta, {
        op: 'exec',
        sql: `DELETE FROM ${table} WHERE user_id = ?`,
        params: [uid],
      });
    }
    await ingestService.db.vectorDelete(pid, names.stVectors, { filter: { user_id: uid } });
    await ingestService.db.vectorDelete(pid, names.ltVectors, { filter: { user_id: uid } });
    res.json({ deleted: true, user_id: uid });
  } catch (e) { err(res, e, next); }
});

module.exports = r;
