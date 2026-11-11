const express = require('express');
const { crudRouter, projectId } = require('../../../shared/crudBase');
const { ListService, DownloadService } = require('../services/DownloadService');
const { DownloadWindow, Indexer } = require('../models');
const { CrudService } = require('../../../shared/crudBase');

const service = new ListService();
const downloads = new DownloadService();
const windows = new CrudService(DownloadWindow);
const indexers = new CrudService(Indexer);
const router = express.Router();

router.get('/info', (req, res) => {
  res.json({
    service: process.env.SERVICE_NAME || 'download_manager',
    title: 'Download lists',
    aws: 'MediaConvert + ingest',
    status: 'active',
    message: 'qBittorrent + Jackett + yt-dlp. Paste URLs work with zero indexers.',
  });
});

router.post('/quick-add', async (req, res, next) => {
  try {
    const pid = projectId(req);
    const urls = req.body?.urls || (req.body?.url ? [req.body.url] : []);
    const result = await downloads.addItems(pid, {
      list: req.body?.list || 'inbox',
      window: req.body?.window || 'overnight',
      urls,
      format: req.body?.format,
      system_id: req.body?.system_id,
      bucket: req.body?.bucket,
      prefix: req.body?.prefix,
    });
    res.status(201).json(result);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

router.post('/search', async (req, res, next) => {
  try {
    res.json(await downloads.search(projectId(req), req.body || {}));
  } catch (e) { next(e); }
});

// YouTube search — separate engine from the torrent /search above.
// Body: { query, max? }  ->  { results: [{id,url,title,duration,channel,view_count,thumbnail}], source:'youtube', engine:'yt-dlp' }
router.post('/search/youtube', async (req, res, next) => {
  try {
    res.json(await downloads.searchYouTube(projectId(req), req.body || {}));
  } catch (e) { next(e); }
});

router.get('/lists/:id/items', async (req, res, next) => {
  try {
    res.json({ items: await downloads.listItems(projectId(req), req.params.id) });
  } catch (e) { next(e); }
});

router.post('/lists/:id/items', async (req, res, next) => {
  try {
    const pid = projectId(req);
    const urls = req.body?.urls || (req.body?.url ? [req.body.url] : []);
    const result = await downloads.addItems(pid, {
      list: req.params.id,
      urls,
      format: req.body?.format,
      window: req.body?.window,
      system_id: req.body?.system_id,
      bucket: req.body?.bucket,
      prefix: req.body?.prefix,
    });
    res.status(201).json(result);
  } catch (e) { next(e); }
});

router.get('/items', async (req, res, next) => {
  try {
    res.json({ items: await downloads.listAllItems(projectId(req), req.query || {}) });
  } catch (e) { next(e); }
});

router.get('/items/:id', async (req, res, next) => {
  try {
    res.json({ item: await downloads.getItem(req.params.id, projectId(req)) });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

router.patch('/items/:id', async (req, res, next) => {
  try {
    res.json({ item: await downloads.updateItem(req.params.id, projectId(req), req.body || {}) });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

router.delete('/items/:id', async (req, res, next) => {
  try {
    res.json(await downloads.deleteItem(req.params.id, projectId(req)));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: { message: e.message } });
    next(e);
  }
});

for (const action of ['pause', 'resume', 'retry']) {
  router.post(`/items/:id/${action}`, async (req, res, next) => {
    try {
      const map = { pause: 'paused', resume: 'pending', retry: 'pending' };
      res.json({ item: await downloads.setStatus(req.params.id, projectId(req), map[action], { error: '' }) });
    } catch (e) {
      if (e.status) return res.status(e.status).json({ error: { message: e.message } });
      next(e);
    }
  });
}

router.post('/tick', async (req, res, next) => {
  try {
    const now = req.body?.now ? new Date(req.body.now) : new Date();
    res.json(await downloads.tick(now));
  } catch (e) { next(e); }
});

router.use('/windows', crudRouter(windows));
router.use('/indexers', crudRouter(indexers));
router.use('/lists', crudRouter(service));
module.exports = { router, service, downloads };
