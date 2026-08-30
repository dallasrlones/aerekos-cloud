const express = require('express');
const containerHost = require('../services/ContainerHostService');

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const containers = await containerHost.listContainers();
    res.json({ containers });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const container = await containerHost.getContainer(req.params.id);
    res.json({ container });
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

router.post('/:id/start', async (req, res) => {
  try {
    const container = await containerHost.startContainer(req.params.id);
    res.json({ container });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/:id/stop', async (req, res) => {
  try {
    const container = await containerHost.stopContainer(req.params.id);
    res.json({ container });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/:id/logs', async (req, res) => {
  try {
    const logs = await containerHost.getLogs(req.params.id, {
      tail: req.query.tail,
      since: req.query.since,
    });
    res.json({ logs });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/:id/exec', async (req, res) => {
  try {
    const result = await containerHost.execContainer(req.params.id, req.body?.cmd, {
      tty: req.body?.tty,
    });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
