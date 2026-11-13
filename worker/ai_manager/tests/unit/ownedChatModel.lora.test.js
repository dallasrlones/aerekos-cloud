'use strict';

const { resolveOwnedChatModel } = require('../../api/services/ownedChatModel');

describe('resolveOwnedChatModel selected LoRA', () => {
  test('ollama uses selected adapter derived_model', () => {
    const { model, isVllm } = resolveOwnedChatModel({
      endpoint: {
        model: 'gemma4',
        lora: [
          { name: 'a', derived_model: 'gemma4-a' },
          { name: 'b', derived_model: 'gemma4-b', selected: true },
        ],
      },
      provider: { provider: 'ollama' },
    });
    expect(isVllm).toBe(false);
    expect(model).toBe('gemma4-b');
  });

  test('vllm skips lora suffix', () => {
    const { model, isVllm } = resolveOwnedChatModel({
      endpoint: { model: 'qwen', lora: [{ name: 'p', derived_model: 'qwen-p' }] },
      provider: { provider: 'vllm' },
    });
    expect(isVllm).toBe(true);
    expect(model).toBe('qwen');
  });
});
