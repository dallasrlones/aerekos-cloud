'use strict';

const express = require('express');
const authenticate = require('../middleware/auth');
const { Project, Worker, Service } = require('../models');

const router = express.Router();

router.get('/', authenticate, async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    const projectId = req.query.project_id || req.headers['x-project-id'];
    const projects = await Project.findAll(projectId ? { where: { id: projectId } } : {});
    const hits = projects
      .filter((p) => !q || String(p.name || '').toLowerCase().includes(q) || String(p.description || '').toLowerCase().includes(q))
      .map((p) => ({ type: 'project', id: p.id, name: p.name }));
    if (!projectId || !q) {
      const workers = await Worker.findAll();
      for (const w of workers) {
        const name = String(w.hostname || '');
        if (!q || name.toLowerCase().includes(q)) hits.push({ type: 'worker', id: w.id, name });
      }
    }
    try {
      const services = await Service.findAll();
      for (const s of services) {
        const name = String(s.name || '');
        if (!q || name.toLowerCase().includes(q)) hits.push({ type: 'service', id: s.id, name });
      }
    } catch (_) { /* services table may be empty */ }
    res.json({ q, items: hits.slice(0, 50) });
  } catch (e) { next(e); }
});

module.exports = router;
