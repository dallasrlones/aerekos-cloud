const express = require('express');
const { QueueService } = require('../services/QueueService');

const router = express.Router();
const service = new QueueService();

/**
 * project_id: query (GET/DELETE) or body (POST)
 */
function getProjectId(req) {
  return req.query.project_id || req.body?.project_id || req.headers['x-project-id'];
}

router.post('/', async (req, res, next) => {
  try {
    const projectId = getProjectId(req);
    const q = await service.createQueue({
      name: req.body?.name,
      projectId,
      visibilityTimeoutSeconds: req.body?.visibility_timeout_seconds,
      engine: req.body?.engine,
      dlq: req.body?.dlq,
      maxReceive: req.body?.max_receive,
    });
    res.status(201).json({ queue: service.serialize(q, 0) });
  } catch (e) {
    next(e);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const projectId = getProjectId(req);
    const list = await service.listQueues(projectId);
    const queues = [];
    for (const q of list) {
      const depth = await service.depthFor(q);
      queues.push(service.serialize(q, depth));
    }
    res.json({ queues });
  } catch (e) {
    next(e);
  }
});

router.get('/:name', async (req, res, next) => {
  try {
    const projectId = getProjectId(req);
    const q = await service.getQueueByName(req.params.name, projectId);
    const depth = await service.depthFor(q);
    res.json({ queue: service.serialize(q, depth) });
  } catch (e) {
    next(e);
  }
});

router.patch('/:name', async (req, res, next) => {
  try {
    const projectId = getProjectId(req);
    const q = await service.getQueueByName(req.params.name, projectId);
    const patch = {};
    if (req.body?.visibility_timeout_seconds != null) {
      patch.visibility_timeout_seconds = service.parseVisibility(req.body.visibility_timeout_seconds);
    }
    if (req.body?.dlq != null) patch.dlq = String(req.body.dlq);
    if (req.body?.max_receive != null) patch.max_receive = Number(req.body.max_receive) || 3;
    if (req.body?.name != null && String(req.body.name) !== q.name) {
      const e = new Error('renaming a queue is not allowed');
      e.status = 400;
      throw e;
    }
    const updated = Object.keys(patch).length ? await service.Queue.update(q.id, patch) : q;
    const row = Array.isArray(updated) ? updated[0] : (updated || q);
    const fresh = await service.getQueueByName(req.params.name, projectId);
    const depth = await service.depthFor(fresh);
    res.json({ queue: service.serialize(fresh, depth) });
  } catch (e) { next(e); }
});

router.delete('/:name', async (req, res, next) => {
  try {
    const projectId = getProjectId(req);
    const r = await service.deleteQueue(req.params.name, projectId);
    res.json(r);
  } catch (e) {
    next(e);
  }
});

router.post('/:name/messages', async (req, res, next) => {
  try {
    const projectId = getProjectId(req);
    const r = await service.sendMessage(req.params.name, projectId, req.body?.body, {
      group_id: req.body?.group_id,
      dedup_id: req.body?.dedup_id,
    });
    res.status(201).json(r);
  } catch (e) {
    next(e);
  }
});

router.post('/:name/messages/receive', async (req, res, next) => {
  try {
    const projectId = getProjectId(req);
    const r = await service.receiveMessages(
      req.params.name,
      projectId,
      req.body?.max_number_of_messages || req.query.max,
      req.body?.visibility_timeout_seconds
    );
    res.json(r);
  } catch (e) {
    next(e);
  }
});

router.delete('/:name/messages/:messageId', async (req, res, next) => {
  try {
    const projectId = getProjectId(req);
    const r = await service.deleteMessage(req.params.name, projectId, req.params.messageId);
    res.json(r);
  } catch (e) {
    next(e);
  }
});

router.post('/:name/messages/:messageId/visibility', async (req, res, next) => {
  try {
    const projectId = getProjectId(req);
    const r = await service.changeVisibility(
      req.params.name,
      projectId,
      req.params.messageId,
      req.body?.visibility_timeout_seconds
    );
    res.json(r);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
