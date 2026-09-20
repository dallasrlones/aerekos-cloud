const { AiProviderService } = require('./AiProviderService');

/** Local fleet defaults derived from ai_manager env (Orin / GPU host). */
function localDefaults(env = process.env) {
  const ollama = (env.OLLAMA_HOST || 'http://host.docker.internal:11434').replace(/\/$/, '');
  const vllm = (env.VLLM_HOST || 'http://host.docker.internal:8000').replace(/\/$/, '');
  const embedModel = env.EMBEDDING_MODEL || env.OLLAMA_EMBED_MODEL || 'mxbai-embed-large';
  const llmBackend = String(env.LLM_BACKEND || 'ollama').toLowerCase();
  return [
    {
      name: 'orin-ollama',
      capability: 'llm',
      provider: 'ollama',
      endpoint: ollama,
      model: '',
      is_default: llmBackend !== 'vllm' ? 'true' : 'false',
      enabled: 'true',
    },
    {
      name: 'orin-vllm',
      capability: 'llm',
      provider: 'vllm',
      endpoint: vllm,
      model: env.VLLM_DEFAULT_MODEL || 'shawnw3i/Huihui-Qwen3.8-27B-abliterated-AWQ-MTP',
      is_default: llmBackend === 'vllm' ? 'true' : 'false',
      enabled: llmBackend === 'vllm' ? 'true' : 'false',
      options: JSON.stringify({
        quantization: env.VLLM_QUANTIZATION || 'awq',
        dtype: env.VLLM_DTYPE || 'half',
        gpu_memory_utilization: parseFloat(env.VLLM_GPU_MEMORY_UTILIZATION || '0.90'),
        max_model_len: parseInt(env.VLLM_MAX_MODEL_LEN || '8192', 10),
        max_num_seqs: parseInt(env.VLLM_MAX_NUM_SEQS || '8', 10),
        enable_prefix_caching: true,
        enforce_eager: true,
        reasoning_parser: env.VLLM_REASONING_PARSER || 'qwen3',
      }),
    },
    {
      name: 'orin-embeddings',
      capability: 'embeddings',
      provider: 'ollama',
      endpoint: ollama,
      model: embedModel,
      is_default: 'true',
      enabled: 'true',
    },
    {
      name: 'orin-tts-cache',
      capability: 'tts',
      provider: 'cache',
      endpoint: (env.TTS_CACHE_URL || 'http://host.docker.internal:8015').replace(/\/$/, ''),
      model: env.TTS_VOICE || 'af_heart',
      is_default: (env.TTS_BACKEND || 'cache').toLowerCase() === 'cache' ? 'true' : 'false',
      enabled: 'true',
      options: JSON.stringify({ language: env.TTS_LANGUAGE || 'en' }),
    },
    {
      name: 'orin-tts-kokoro',
      capability: 'tts',
      provider: 'kokoro',
      endpoint: (env.TTS_KOKORO_URL || 'http://host.docker.internal:8013').replace(/\/$/, ''),
      model: env.TTS_VOICE || 'af_heart',
      is_default: (env.TTS_BACKEND || 'cache').toLowerCase() === 'kokoro' ? 'true' : 'false',
      enabled: 'true',
      options: JSON.stringify({ language: env.TTS_LANGUAGE || 'en' }),
    },
    {
      name: 'orin-tts-xtts',
      capability: 'tts',
      provider: 'xtts',
      endpoint: (env.TTS_XTTS_URL || 'http://host.docker.internal:8002').replace(/\/$/, ''),
      model: '',
      is_default: (env.TTS_BACKEND || 'cache').toLowerCase() === 'xtts' ? 'true' : 'false',
      enabled: 'true',
    },
    {
      name: 'orin-stt',
      capability: 'stt',
      provider: 'whisper',
      endpoint: (env.STT_URL || 'http://host.docker.internal:8001').replace(/\/$/, ''),
      model: '',
      is_default: 'true',
      enabled: 'true',
    },
  ];
}

class LocalIntegrationSeed {
  constructor() {
    this.providers = new AiProviderService();
  }

  async seed(projectId) {
    const created = [];
    const skipped = [];
    for (const row of localDefaults()) {
      const existing = await this.providers.M.findAll({
        where: { project_id: projectId, name: row.name },
      });
      if (existing.length) {
        skipped.push(row.name);
        continue;
      }
      const item = await this.providers.create({ ...row, project_id: projectId });
      created.push(item);
    }
    return { created, skipped, items: await this.providers.list(projectId) };
  }
}

module.exports = { LocalIntegrationSeed, localDefaults };
