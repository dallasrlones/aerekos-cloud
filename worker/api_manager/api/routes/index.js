const express = require('express');
const resR = require('./endpoints');
const dataApis = require('./dataApis');
const dataRecords = require('./dataRecords');
const { DataApiService } = require('../services/DataApiService');
const router = express.Router();
router.get('/info', (req, res) => { res.json({ service: process.env.SERVICE_NAME || 'api_manager', title: 'api_manager', version: process.env.SERVICE_VERSION || '1.0.0', status: 'active', message: 'API gateway + hosted Data API (schema → DB, relationships, autoscaling).' }); });
router.post('/ensure-defaults', async (req, res, next) => {
  try {
    const pid = req.body?.project_id || req.query.project_id || req.headers['x-project-id'];
    if (!pid) return res.status(400).json({ error: { message: 'project_id is required' } });
    const defaults = await new DataApiService().ensureDefaults(pid);
    res.json({ ok: true, defaults });
  } catch (err) { next(err); }
});
router.use('/data-apis', dataApis);
router.use('/data', dataRecords);
router.use('/endpoints', resR);
module.exports = router;
