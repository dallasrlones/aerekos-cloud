const express = require('express');
const resR = require('./events');
const router = express.Router();
router.get('/info', (req, res) => {
  res.json({
    service: process.env.SERVICE_NAME || 'analytics_manager',
    title: 'analytics_manager',
    version: process.env.SERVICE_VERSION || '1.0.0',
    status: 'active',
    aws: 'Pinpoint / Kinesis Analytics',
    message: 'Structured analytics events + query-on-storage (SQLite in-memory; DuckDB naming analog).',
  });
});
router.post('/query-on-storage', async (req, res) => {
  const sql = String(req.body?.sql || 'SELECT * FROM events LIMIT 100').trim();
  if (process.env.SKIP_DUCKDB === '1' || process.env.SKIP_DUCKDB === 'true') {
    return res.json({
      rows: /^select\s+1\b/i.test(sql) ? [{ '1': 1 }] : [],
      sql,
      engine: 'sqlite',
      skipped: true,
    });
  }
  if (/\b(attach|vacuum)\b/i.test(sql)) {
    return res.status(400).json({ error: { message: 'ATTACH/VACUUM are not allowed' } });
  }
  const pid = req.body?.project_id || req.query.project_id || req.headers['x-project-id'];
  const { AnalyticsEvent } = require('../models');
  const Database = require('better-sqlite3');
  const where = pid ? { project_id: pid } : {};
  const events = await AnalyticsEvent.findAll({ where });
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE events (
    id TEXT, project_id TEXT, name TEXT, event TEXT, value TEXT, properties TEXT, created_at TEXT
  )`);
  const ins = db.prepare('INSERT INTO events VALUES (@id,@project_id,@name,@event,@value,@properties,@created_at)');
  const tx = db.transaction((rows) => {
    for (const e of rows) {
      ins.run({
        id: e.id,
        project_id: e.project_id,
        name: e.name,
        event: e.event,
        value: e.value,
        properties: typeof e.properties === 'string' ? e.properties : JSON.stringify(e.properties || {}),
        created_at: e.created_at,
      });
    }
  });
  tx(events);
  try {
    const stmt = db.prepare(sql);
    const rows = stmt.reader ? stmt.all() : [];
    res.json({ rows, sql, engine: 'sqlite', count: events.length, prefix: req.body?.prefix || req.body?.bucket || null });
  } catch (err) {
    res.status(400).json({ error: { message: err.message }, sql });
  } finally {
    db.close();
  }
});
router.use('/events', resR);
module.exports = router;
