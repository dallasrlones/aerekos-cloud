const express = require('express');
const { crudRouter, projectId } = require('../../../shared/crudBase');
const { BusService, EventService } = require('../services/EventService');

const service = new BusService();
const events = new EventService();
const router = express.Router();

router.get('/info', (req, res) => {
  res.json({
    service: process.env.SERVICE_NAME || 'event_manager',
    title: 'Event buses',
    version: process.env.SERVICE_VERSION || '1.0.0',
    status: 'active',
    aws: 'EventBridge',
    message: 'Publish once; route to queue/webhook/websocket/function/email/sms/slack/iot/push',
  });
});

router.post('/events', async (req, res, next) => {
  try {
    const pid = projectId(req);
    if (!pid) return res.status(400).json({ error: { message: 'project_id required' } });
    const result = await events.put(pid, req.body || {});
    res.status(202).json(result);
  } catch (e) {
    next(e);
  }
});

router.post('/rules', async (req, res, next) => {
  try {
    const item = await events.createRule({ ...req.body, project_id: projectId(req) });
    res.status(201).json({ item });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

router.get('/rules', async (req, res, next) => {
  try {
    res.json({ items: await events.listRules(projectId(req), req.query.bus_id) });
  } catch (e) {
    next(e);
  }
});

router.use('/buses', crudRouter(service));
module.exports = { router, service };
