'use strict';

const { OllamaService } = require('./OllamaService');
const { VllmService } = require('./VllmService');
const { ProviderResolver } = require('./ProviderResolver');

const defaultOllama = new OllamaService();
const defaultVllm = new VllmService();
const resolver = new ProviderResolver();

function fromResolved(cfg) {
  const ptype = cfg?.provider_type;
  if (ptype === 'vllm' && cfg.endpoint) {
    return new VllmService({
      ...process.env,
      VLLM_HOST: cfg.endpoint,
      VLLM_DEFAULT_MODEL: cfg.model || process.env.VLLM_DEFAULT_MODEL || '',
      VLLM_API_KEY: cfg.apiKey || cfg.options?.api_key || process.env.VLLM_API_KEY || '',
    });
  }
  if (ptype === 'ollama' && cfg.endpoint) {
    return new OllamaService({ ...process.env, OLLAMA_HOST: cfg.endpoint, OLLAMA_MODE: 'external' });
  }
  return null;
}

async function resolveLlm(req) {
  const cfg = await resolver.resolve(req, 'llm');
  const fromCfg = fromResolved(cfg);
  if (fromCfg) return fromCfg;

  const backend = String(process.env.LLM_BACKEND || 'ollama').toLowerCase();
  if (backend === 'vllm') return defaultVllm;
  return defaultOllama;
}

/** @deprecated use resolveLlm — kept so existing llm routes keep working. */
const resolveOllama = resolveLlm;

async function resolveLlmByIntegration(projectId, integrationName) {
  const fakeReq = {
    query: { project_id: projectId, integration: integrationName || undefined },
    body: { project_id: projectId, integration: integrationName || undefined },
    headers: {},
  };
  return resolveLlm(fakeReq);
}

module.exports = { resolveOllama, resolveLlm, resolveLlmByIntegration, defaultOllama, defaultVllm };
