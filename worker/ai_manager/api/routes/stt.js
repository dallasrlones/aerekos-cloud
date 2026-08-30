const express = require('express');
const multer = require('multer');
const { VoiceProxyService } = require('../services/VoiceProxyService');
const { ProviderResolver } = require('../services/ProviderResolver');
const { requireAuth } = require('../../../shared/authManagerClient');
const { requireResource } = require('../../../shared/requireResource');

const r = express.Router();
const defaultVoice = new VoiceProxyService();
const resolver = new ProviderResolver();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

r.use(requireAuth());

const err = (res, e, next) => {
  if (e && e.status) return res.status(e.status).json({ error: { message: e.message } });
  return next(e);
};

async function resolveVoice(req) {
  const cfg = await resolver.resolve(req, 'stt');
  if (cfg) return VoiceProxyService.forIntegration(cfg);
  return defaultVoice;
}

r.get('/status', async (req, res, next) => {
  try {
    const voice = await resolveVoice(req);
    res.json(await voice.sttStatus());
  } catch (e) { err(res, e, next); }
});

r.post('/transcribe/json', requireResource({ requiredScope: 'ai:InvokeStt' }), async (req, res, next) => {
  try {
    const b64 = req.body?.audio_base64;
    if (!b64) return res.status(400).json({ error: { message: 'audio_base64 is required' } });
    const buf = Buffer.from(b64, 'base64');
    const voice = await resolveVoice(req);
    const result = await voice.transcribe(buf, {
      contentType: req.body?.content_type || 'audio/wav',
      filename: req.body?.filename,
      language: req.body?.language,
      task: req.body?.task,
    });
    res.json(result);
  } catch (e) { err(res, e, next); }
});

r.post('/transcribe', requireResource({ requiredScope: 'ai:InvokeStt' }), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer?.length) {
      return res.status(400).json({ error: { message: 'file is required (multipart)' } });
    }
    const voice = await resolveVoice(req);
    const result = await voice.transcribe(req.file.buffer, {
      contentType: req.file.mimetype,
      filename: req.file.originalname,
      language: req.body?.language || req.query?.language,
      task: req.body?.task || req.query?.task,
    });
    res.json(result);
  } catch (e) { err(res, e, next); }
});

module.exports = r;
