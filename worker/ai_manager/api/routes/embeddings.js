const express = require('express');
const { EmbeddingService } = require('../services/EmbeddingService');
const { ProviderResolver } = require('../services/ProviderResolver');
const { requireAuth } = require('../../../shared/authManagerClient');
const { requireResource } = require('../../../shared/requireResource');

const r = express.Router();
const embeddings = new EmbeddingService();
const resolver = new ProviderResolver();

r.use(requireAuth());

const err = (res, e, next) => {
  if (e && e.status) return res.status(e.status).json({ error: { message: e.message } });
  if (e && e.code === 'ECONNREFUSED') return res.status(503).json({ error: { message: 'Ollama backend unreachable' } });
  return next(e);
};

async function resolveEmbeddings(req) {
  const cfg = await resolver.resolve(req, 'embeddings');
  if (cfg?.provider_type === 'ollama' && cfg.endpoint) {
    const env = { ...process.env, OLLAMA_HOST: cfg.endpoint, OLLAMA_MODE: 'external' };
    if (cfg.model) env.EMBEDDING_MODEL = cfg.model;
    return new EmbeddingService(env);
  }
  return embeddings;
}

r.get('/status', async (req, res, next) => {
  try { res.json(await embeddings.status()); } catch (e) { err(res, e, next); }
});

r.post('/', requireResource({ requiredScope: 'ai:InvokeEmbeddings' }), async (req, res, next) => {
  try {
    const svc = await resolveEmbeddings(req);
    res.json(await svc.embed(req.body || {}));
  } catch (e) { err(res, e, next); }
});

module.exports = r;
