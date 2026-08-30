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
    res.status(201).json({
      queue: {
        id: q.id,
        name: q.name,
        project_id: q.project_id,
        visibility_timeout_seconds: q.visibility_timeout_seconds,
        engine: q.engine || 'standard',
        dlq: q.dlq || '',
        created_at: q.created_at
      }
    });
  } catch (e) {
    next(e);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const projectId = getProjectId(req);
    const list = await service.listQueues(projectId);
    res.json({
      queues: list.map((q) => ({
        id: q.id,
        name: q.name,
        project_id: q.project_id,
        visibility_timeout_seconds: q.visibility_timeout_seconds,
        created_at: q.created_at
      }))
    });
  } catch (e) {
    next(e);
  }
});

router.get('/:name', async (req, res, next) => {
  try {
    const projectId = getProjectId(req);
    const q = await service.getQueueByName(req.params.name, projectId);
    res.json({
      queue: {
        id: q.id,
        name: q.name,
        project_id: q.project_id,
        visibility_timeout_seconds: q.visibility_timeout_seconds,
        created_at: q.created_at
      }
    });
  } catch (e) {
    next(e);
  }
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
