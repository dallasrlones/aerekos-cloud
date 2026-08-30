const express = require('express');
const reposRouter = require('./repos');
const { RepoService } = require('../services/RepoService');

const router = express.Router();
const svc = new RepoService();

router.get('/info', (req, res) => {
  res.json({
    service: 'git_manager',
    status: 'active',
    capabilities: ['git', 'scm', 'repositories', 'smart-http'],
    transport: 'Git Smart HTTP at /git/:project/:repo.git',
    version: process.env.SERVICE_VERSION || '1.0.0'
  });
});

router.use('/repos', reposRouter);
router.use('/pulls', require('./pulls'));

// Internal sink for the per-repo post-receive hook (loopback only).
router.post('/internal/push-events', async (req, res, next) => {
  try {
    const ev = await svc.recordPush(req.body || {});
    res.status(201).json({ recorded: true, id: ev.id });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

module.exports = router;
