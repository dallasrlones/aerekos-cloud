const express = require('express');
const { RepoService } = require('../services/RepoService');

const router = express.Router();
const svc = new RepoService();

function qProject(req) {
  return req.query.project_id || req.body?.project_id || req.headers['x-project-id'];
}

function handle(res, next, e) {
  if (e.status) {
    return res.status(e.status).json({ error: { message: e.message, code: e.code } });
  }
  next(e);
}

router.post('/:id/commit-file', async (req, res, next) => {
  try {
    const result = await svc.commitFile(req.params.id, qProject(req), {
      filePath: req.body?.path || req.body?.filePath || 'stack.json',
      content: req.body?.content,
      message: req.body?.message,
      branch: req.body?.branch,
      baseSha: req.body?.base_sha || req.body?.baseSha,
    });
    res.json({ ...result, committed: true });
  } catch (e) {
    handle(res, next, e);
  }
});

router.post('/:id/delete-file', async (req, res, next) => {
  try {
    const result = await svc.deleteFile(req.params.id, qProject(req), {
      filePath: req.body?.path || req.body?.filePath,
      message: req.body?.message,
      branch: req.body?.branch,
      baseSha: req.body?.base_sha || req.body?.baseSha,
    });
    res.json({ ...result, deleted: true });
  } catch (e) {
    handle(res, next, e);
  }
});

router.post('/:id/branches', async (req, res, next) => {
  try {
    const result = await svc.createBranch(req.params.id, qProject(req), {
      name: req.body?.name || req.body?.branch,
      from: req.body?.from || req.body?.source,
    });
    res.status(201).json(result);
  } catch (e) {
    handle(res, next, e);
  }
});

router.get('/:id/compare', async (req, res, next) => {
  try {
    const result = await svc.compare(req.params.id, qProject(req), {
      base: req.query.base,
      head: req.query.head,
    });
    res.json(result);
  } catch (e) {
    handle(res, next, e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const created = await svc.create({ ...req.body, project_id: req.body.project_id || qProject(req) });
    res.status(201).json({ repository: created });
  } catch (e) {
    handle(res, next, e);
  }
});

router.get('/', async (req, res, next) => {
  try {
    res.json({ repositories: await svc.list(qProject(req)) });
  } catch (e) {
    handle(res, next, e);
  }
});

router.get('/:id/bundle', async (req, res, next) => {
  try {
    const archive = await svc.bundleBuffer(req.params.id, qProject(req));
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${archive.filename}"`);
    res.send(archive.buf);
  } catch (e) {
    handle(res, next, e);
  }
});

router.post('/:id/unbundle', express.raw({ type: () => true, limit: '100mb' }), async (req, res, next) => {
  try {
    const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || []);
    if (!buf.length) {
      const e = new Error('bundle body is required');
      e.status = 400;
      throw e;
    }
    const result = await svc.restoreFromBuffer(req.params.id, qProject(req), buf);
    res.json(result);
  } catch (e) {
    handle(res, next, e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    res.json({ repository: await svc.get(req.params.id, qProject(req)) });
  } catch (e) {
    handle(res, next, e);
  }
});

router.get('/:id/tree', async (req, res, next) => {
  try {
    const entries = await svc.tree(req.params.id, qProject(req), req.query.ref, req.query.path);
    res.json({ entries });
  } catch (e) {
    handle(res, next, e);
  }
});

router.get('/:id/blob', async (req, res, next) => {
  try {
    if (!req.query.path) return res.status(400).json({ error: { message: 'path is required' } });
    const blob = await svc.blob(req.params.id, qProject(req), req.query.ref, req.query.path);
    res.json(blob);
  } catch (e) {
    handle(res, next, e);
  }
});

router.get('/:id/branches', async (req, res, next) => {
  try {
    res.json({ branches: await svc.branches(req.params.id, qProject(req)) });
  } catch (e) {
    handle(res, next, e);
  }
});

router.get('/:id/commits', async (req, res, next) => {
  try {
    const commits = await svc.commits(req.params.id, qProject(req), req.query.branch, req.query.limit);
    res.json({ commits });
  } catch (e) {
    handle(res, next, e);
  }
});

router.get('/:id/pushes', async (req, res, next) => {
  try {
    res.json({ pushes: await svc.listPushEvents(qProject(req), req.params.id) });
  } catch (e) {
    handle(res, next, e);
  }
});

const updateHandler = async (req, res, next) => {
  try {
    res.json({ repository: await svc.update(req.params.id, qProject(req), req.body || {}) });
  } catch (e) {
    handle(res, next, e);
  }
};
router.patch('/:id', updateHandler);
router.put('/:id', updateHandler);

router.delete('/:id', async (req, res, next) => {
  try {
    res.json(await svc.del(req.params.id, qProject(req)));
  } catch (e) {
    handle(res, next, e);
  }
});

module.exports = router;
