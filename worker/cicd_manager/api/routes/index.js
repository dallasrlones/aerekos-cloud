const express = require('express');
const resR = require('./pipelines');
const router = express.Router();
router.get('/info', (req, res) => { res.json({ service: process.env.SERVICE_NAME || 'cicd_manager', title: 'cicd_manager', version: process.env.SERVICE_VERSION || '1.0.0', status: 'active', message: 'Pipelines run after merge. App repos deploy the env task; system aerekos-cloud main publishes a fleet release. Sandbox aerekos-cloud stays a no-op.' }); });
const { CicdPipelineService } = require('../services/CicdPipelineService');
const cicd = new CicdPipelineService();
router.post('/pipelines/run-for-repo', async (req, res, next) => {
  try {
    const pid = req.body?.project_id || req.query.project_id || req.headers['x-project-id'];
    res.json(await cicd.runForRepo(pid, req.body || {}, req.headers || {}));
  } catch (e) { if (e.status) return res.status(e.status).json({ error: { message: e.message } }); next(e); }
});
router.use('/pipelines', resR);
module.exports = router;
