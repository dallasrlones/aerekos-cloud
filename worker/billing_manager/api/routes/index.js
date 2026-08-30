const express = require('express');
const { knockoutTry } = require('../../../shared/knockoutTry');
const { crudRouter, projectId } = require('../../../shared/crudBase');
const { ItemService } = require('../services/ItemService');
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

function asNumber(v, fallback = 0) {
  if (v == null || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

router.get('/info', (req, res) => {
  res.json({
    service: process.env.SERVICE_NAME || 'billing_manager',
    title: 'Usage meters',
    version: process.env.SERVICE_VERSION || '1.0.0',
    status: 'active',
    aws: 'Cost Explorer',
    message: 'Usage meters'
  });
});

router.post('/evaluate-quota', wrap(async (req, res) => {
  const pid = projectId(req);
  if (!pid) return res.status(400).json({ error: { message: 'project_id required' } });
  const meter = String(req.body?.meter || 'compute_seconds');
  const items = await service.list(pid);
  const row = items.find((i) => i.name === meter);
  if (!row) return res.status(404).json({ error: { message: `meter not found: ${meter}` }, allowed: false, meter });
  let value = asNumber(row.value, 0);
  const increment = asNumber(req.body?.increment, 0);
  if (increment) {
    value += increment;
    await service.update(row.id, pid, { value: String(value) });
  }
  const limitRaw = (row.quota_limit != null && row.quota_limit !== '')
    ? row.quota_limit
    : (row.limit != null && row.limit !== '' ? row.limit : req.body?.limit);
  const limit = limitRaw == null || limitRaw === '' ? null : asNumber(limitRaw, null);
  const over = limit != null && value > limit;
  const remaining = limit == null ? null : Math.max(0, limit - value);
  res.json({
    allowed: !over,
    remaining,
    meter,
    value,
    unit: row.unit || req.body?.unit || null,
    limit,
  });
}));

router.use(knockoutTry(process.env.SERVICE_NAME || 'billing_manager'));
router.use('/meters', crudRouter(service));
module.exports = { router, service };
