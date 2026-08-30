const express = require('express');
const models = require('./models');
const llm = require('./llm');
const embeddings = require('./embeddings');
const memory = require('./memory');
const providers = require('./providers');

const router = express.Router();

router.get('/info', (req, res) => {
  res.json({
    service: process.env.SERVICE_NAME || 'ai_manager',
    title: 'ai_manager',
    version: process.env.SERVICE_VERSION || '1.0.0',
    status: 'active',
  });
});

router.use('/models', models);
router.use('/llm', llm);
router.use('/embeddings', embeddings);
router.use('/memory', memory);
router.use('/providers', providers);
router.use('/allowlist', require('./allowlist'));
router.use('/intelligence', require('./intelligence'));
router.use('/rag', require('./rag'));
router.use('/lora', require('./lora'));

for (const [mount, file] of [
  ['/stt', './stt'],
  ['/tts', './tts'],
]) {
  try {
    router.use(mount, require(file));
  } catch (err) {
    console.warn(`[ai_manager] ${file} not mounted: ${err.message}`);
  }
}

module.exports = router;
