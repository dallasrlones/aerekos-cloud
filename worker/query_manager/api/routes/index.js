const express = require('express');
const { knockoutTry } = require('../../../shared/knockoutTry');
const { crudRouter } = require('../../../shared/crudBase');
const { ItemService } = require('../services/ItemService');
const service = new ItemService();
const router = express.Router();
router.get('/info', (req, res) => {
  res.json({
    service: process.env.SERVICE_NAME || 'query_manager',
    title: 'SQL queries',
    version: process.env.SERVICE_VERSION || '1.0.0',
    status: 'active',
    aws: 'Athena',
    message: 'SQL queries'
  });
});
router.post('/sql', async (req, res) => {
  const sql = String(req.body?.sql || 'SELECT 1').trim();
  const skip = process.env.SKIP_DUCKDB === '1' || process.env.SKIP_DUCKDB === 'true';
  if (skip) {
    return res.json({ rows: /^select\s+1\b/i.test(sql) ? [{ '1': 1 }] : [], sql, engine: 'sqlite', skipped: true });
  }
  const pid = req.body?.project_id || req.query.project_id || req.headers['x-project-id'] || 'default';
  if (/\b(attach|vacuum)\b/i.test(sql)) {
    return res.status(400).json({ error: { message: 'ATTACH/VACUUM are not allowed' } });
  }
  const fs = require('fs');
  const path = require('path');
  const Database = require('better-sqlite3');
  const dir = process.env.QUERY_DATA_DIR || path.join(__dirname, '../../data');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `query-${String(pid).replace(/[^a-zA-Z0-9._-]/g, '_')}.sqlite`);
  const db = new Database(file);
  try {
    const stmt = db.prepare(sql);
    if (stmt.reader) {
      return res.json({ rows: stmt.all(), sql, engine: 'sqlite', bucket: req.body?.bucket || null, database: file });
    }
    const info = stmt.run();
    res.json({ rows: [], sql, engine: 'sqlite', changes: info.changes, lastInsertRowid: info.lastInsertRowid, database: file });
  } catch (err) {
    res.status(400).json({ error: { message: err.message }, sql });
  } finally {
    db.close();
  }
});
router.use(knockoutTry(process.env.SERVICE_NAME || 'query_manager'));
router.use('/queries', crudRouter(service));
module.exports = { router, service };
