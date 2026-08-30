const express = require('express');
const axios = require('axios');
const { VoiceProxyService } = require('../services/VoiceProxyService');
const { ProviderResolver } = require('../services/ProviderResolver');
const { requireAuth } = require('../../../shared/authManagerClient');
const { requireResource } = require('../../../shared/requireResource');

const r = express.Router();
const defaultVoice = new VoiceProxyService();
const resolver = new ProviderResolver();

r.use(requireAuth());

const err = (res, e, next) => {
  if (e && e.status) return res.status(e.status).json({ error: { message: e.message } });
  return next(e);
};

async function resolveVoice(req) {
  const cfg = await resolver.resolve(req, 'tts');
  if (cfg) return VoiceProxyService.forIntegration(cfg);
  return defaultVoice;
}

r.get('/status', async (req, res, next) => {
  try {
    const voice = await resolveVoice(req);
    const status = await voice.ttsStatus();
    const stats = status.backend === 'cache'
      ? await voice.cacheStats()
      : null;
    res.json({ ...status, cache_stats: stats });
  } catch (e) { err(res, e, next); }
});

r.get('/cache/stats', async (req, res, next) => {
  try {
    const voice = await resolveVoice(req);
    res.json(await voice.cacheStats());
  } catch (e) { err(res, e, next); }
});

r.get('/voices', async (req, res, next) => {
  try {
    const voice = await resolveVoice(req);
    const url = voice.ttsTarget();
    const { data, status } = await axios.get(`${url}/voices`, { timeout: 8000, validateStatus: () => true });
    if (status >= 400) return res.status(502).json({ error: { message: 'upstream unavailable' } });
    res.json(data);
  } catch (e) { err(res, e, next); }
});

r.post('/synthesize', requireResource({ requiredScope: 'ai:InvokeTts' }), async (req, res, next) => {
  try {
    const voice = await resolveVoice(req);
    const out = await voice.synthesize(req.body || {});
    res.setHeader('Content-Type', out.contentType);
    if (out.voice) res.setHeader('X-Voice', out.voice);
    if (out.language) res.setHeader('X-Language', out.language);
    if (out.cache) res.setHeader('X-Cache', out.cache);
    res.send(out.buffer);
  } catch (e) { err(res, e, next); }
});

module.exports = r;
