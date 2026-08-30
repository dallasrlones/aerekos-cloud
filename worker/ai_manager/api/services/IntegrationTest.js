const axios = require('axios');
const { OllamaService } = require('./OllamaService');
const { VllmService } = require('./VllmService');
const { VoiceProxyService } = require('./VoiceProxyService');
const { AiProviderService } = require('./AiProviderService');

function parseOptions(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch (_) { return {}; }
}

async function testOllama(endpoint) {
  const svc = new OllamaService({
    ...process.env,
    OLLAMA_HOST: endpoint,
    OLLAMA_MODE: 'external',
  });
  const status = await svc.status();
  return { reachable: !!status.reachable, ...status };
}

async function testVoice(endpoint, token) {
  try {
    const { data } = await axios.get(`${endpoint.replace(/\/$/, '')}/health`, {
      timeout: 8000,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      validateStatus: () => true,
    });
    return { reachable: true, ...data };
  } catch (e) {
    return { reachable: false, error: e.message };
  }
}

async function testIntegrationRow(row) {
  const endpoint = (row.endpoint || '').replace(/\/$/, '');
  if (!endpoint) return { reachable: false, error: 'endpoint not configured' };

  const cap = row.capability;
  const provider = row.provider;

  if (cap === 'llm' || cap === 'embeddings') {
    if (provider === 'vllm') {
      const svc = new VllmService({
        ...process.env,
        VLLM_HOST: endpoint,
        VLLM_DEFAULT_MODEL: row.model || '',
      });
      return svc.status();
    }
    if (provider !== 'ollama') {
      return { reachable: false, error: `unsupported local provider: ${provider}` };
    }
    return testOllama(endpoint);
  }

  if (cap === 'tts') {
    const opts = parseOptions(row.options);
    const voice = VoiceProxyService.forIntegration({
      capability: 'tts',
      provider_type: provider,
      endpoint,
      model: row.model,
      options: opts,
    });
    const status = await voice.ttsStatus();
    return status;
  }

  if (cap === 'stt') {
    const voice = VoiceProxyService.forIntegration({
      capability: 'stt',
      provider_type: provider,
      endpoint,
    });
    return voice.sttStatus();
  }

  return { reachable: false, error: `unknown capability: ${cap}` };
}

class IntegrationTest {
  constructor() {
    this.providers = new AiProviderService();
  }

  async test(id, projectId) {
    const row = await this.providers.get(id, projectId);
    const result = await testIntegrationRow(row);
    return { integration: row.name, capability: row.capability, provider: row.provider, endpoint: row.endpoint, ...result };
  }
}

module.exports = { IntegrationTest, testIntegrationRow };
