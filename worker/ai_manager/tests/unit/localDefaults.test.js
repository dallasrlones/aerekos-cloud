'use strict';

const { localDefaults } = require('../../api/services/LocalIntegrationSeed');

describe('LocalIntegrationSeed', () => {
  test('Ollama is default and vLLM disabled unless LLM_BACKEND=vllm', () => {
    const rows = localDefaults({ LLM_BACKEND: 'ollama' });
    const ollama = rows.find((r) => r.provider === 'ollama' && r.capability === 'llm');
    const vllm = rows.find((r) => r.provider === 'vllm');
    expect(ollama.enabled).toBe('true');
    expect(ollama.is_default).toBe('true');
    expect(vllm.enabled).toBe('false');
  });

  test('vLLM enabled only when LLM_BACKEND=vllm', () => {
    const rows = localDefaults({ LLM_BACKEND: 'vllm' });
    const vllm = rows.find((r) => r.provider === 'vllm');
    expect(vllm.enabled).toBe('true');
    expect(vllm.is_default).toBe('true');
  });
});
