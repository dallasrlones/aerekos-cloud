const express = require('express');
const { knockoutTry } = require('../../../shared/knockoutTry');
const { crudRouter, projectId } = require('../../../shared/crudBase');
const { ItemService } = require('../services/ItemService');
const { mintSelfSignedPem, parseImportedPem } = require('../services/mintPem');
const service = new ItemService();
const router = express.Router();

function wrap(fn) {
  return async (req, res, next) => {
    try { await fn(req, res); } catch (e) {
      if (e.status) return res.status(e.status).json({ error: { message: e.message } });
      next(e);
    }
  };
}

router.get('/info', (req, res) => {
  res.json({
    service: process.env.SERVICE_NAME || 'cert_manager',
    title: 'Certificates',
    version: process.env.SERVICE_VERSION || '1.0.0',
    status: 'active',
    aws: 'ACM',
    message: 'Self-signed certificates (no Let\'s Encrypt)'
  });
});

router.post('/certs/mint', wrap(async (req, res) => {
  const pid = projectId(req);
  const name = String(req.body?.name || req.body?.cn || 'default').trim();
  const cn = String(req.body?.cn || name).trim();
  if (!pid) return res.status(400).json({ error: { message: 'project_id required' } });
  if (!name) return res.status(400).json({ error: { message: 'name required' } });
  const minted = mintSelfSignedPem(cn);
  const existing = await service.list(pid);
  const found = existing.find((i) => i.name === name);
  const payload = { pem: minted.pem, hostnames: cn, status: 'minted' };
  const item = found
    ? await service.update(found.id, pid, payload)
    : await service.create({ project_id: pid, name, ...payload });
  res.status(201).json({ item, cn: minted.cn });
}));

router.post('/certs/import', wrap(async (req, res) => {
  const pid = projectId(req);
  const name = String(req.body?.name || 'imported').trim();
  if (!pid) return res.status(400).json({ error: { message: 'project_id required' } });
  const pem = parseImportedPem(req.body?.pem || req.body?.certificate);
  const existing = await service.list(pid);
  const found = existing.find((i) => i.name === name);
  const payload = { pem, hostnames: req.body?.cn || req.body?.hostnames || name, status: 'imported' };
  const item = found
    ? await service.update(found.id, pid, payload)
    : await service.create({ project_id: pid, name, ...payload });
  res.status(201).json({ item });
}));

router.use(knockoutTry(process.env.SERVICE_NAME || 'cert_manager'));
router.use('/certs', crudRouter(service));
module.exports = { router, service };
