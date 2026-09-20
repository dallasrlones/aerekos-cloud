'use strict';

const { resolveOwnedChatModel, pickChatModel } = require('../../api/services/ownedChatModel');

const LORA = [{ name: 'coach', derived_model: 'bound-hf-coach' }];

describe('resolveOwnedChatModel', () => {
  test('uses intelligence.model and ignores a stale client id', () => {
    const { model } = resolveOwnedChatModel({
      endpoint: { model: 'bound-hf', lora: LORA },
      provider: { provider: 'vllm', model: 'provider-model' },
      listedModels: [{ name: 'listed' }],
    });
    expect(model).toBe('bound-hf');
    expect(model).not.toBe('cyankiwi/stale');
  });

  test('vLLM-bound intelligence does not suffix LoRA derived_model', () => {
    const { model, isVllm } = resolveOwnedChatModel({
      endpoint: { model: 'bound-hf', lora: LORA },
      provider: { provider: 'vllm' },
    });
    expect(isVllm).toBe(true);
    expect(model).toBe('bound-hf');
  });

  test('Ollama-bound intelligence still uses LoRA derived_model', () => {
    const { model, isVllm } = resolveOwnedChatModel({
      endpoint: { model: 'bound-hf', lora: LORA, llm_integration: 'orin-ollama' },
      provider: { provider: 'ollama' },
    });
    expect(isVllm).toBe(false);
    expect(model).toBe('bound-hf-coach');
  });

  test('falls back to provider.model then listed chat model', () => {
    expect(resolveOwnedChatModel({
      endpoint: {},
      provider: { provider: 'vllm', model: 'from-provider' },
    }).model).toBe('from-provider');
    expect(resolveOwnedChatModel({
      endpoint: {},
      provider: { provider: 'ollama' },
      listedModels: [{ name: 'llama3.2:3b' }, { name: 'nomic-embed', details: { family: 'nomic-bert' } }],
    }).model).toBe('llama3.2:3b');
  });
});

describe('pickChatModel', () => {
  test('skips embedding families', () => {
    expect(pickChatModel([
      { name: 'mxbai-embed-large', details: { family: 'nomic-bert' } },
      { name: 'llama3.2:1b' },
    ])).toBe('llama3.2:1b');
  });
});
