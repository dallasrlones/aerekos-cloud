'use strict';

const { VllmService } = require('../../api/services/VllmService');

const SERVED = ['shawnw3i/Huihui-Qwen3.8-27B-abliterated-AWQ-MTP'];
const DEFAULT = SERVED[0];

describe('VllmService.pickServedModel', () => {
  test('keeps a model that is actually loaded', () => {
    expect(VllmService.pickServedModel(DEFAULT, SERVED, DEFAULT)).toBe(DEFAULT);
  });

  test('remaps stale HF ids (cyankiwi, etc.) to the loaded model', () => {
    expect(
      VllmService.pickServedModel('cyankiwi/Qwen3.6-35B-A3B-AWQ-4bit', SERVED, DEFAULT),
    ).toBe(DEFAULT);
  });

  test('falls back to first served model when default is also missing', () => {
    expect(VllmService.pickServedModel('nope', SERVED, 'other/missing')).toBe(SERVED[0]);
  });

  test('clamps max_tokens so prompt + output fit max_model_len', () => {
    expect(VllmService.clampMaxTokens(768, 3329, 4096)).toBe(743);
    expect(VllmService.clampMaxTokens(768, 4000, 4096)).toBe(72);
    expect(VllmService.clampMaxTokens(undefined, 100, 4096)).toBe(256);
  });

  test('fitMessages truncates oversized system prompts', () => {
    const huge = { role: 'system', content: 'x'.repeat(20000) };
    const user = { role: 'user', content: 'hi' };
    const out = VllmService.fitMessages([huge, user], 4096, 768);
    expect(VllmService.estimatePromptTokens(out.messages) + out.max_tokens).toBeLessThanOrEqual(4096);
    expect(String(out.messages[0].content).length).toBeLessThan(20000);
  });

  test('preserves tool_calls from OpenAI response', () => {
    const svc = Object.create(VllmService.prototype);
    const out = svc._toOllamaChatResponse({
      choices: [{
        finish_reason: 'tool_calls',
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [{ id: 'c1', function: { name: 'file_list', arguments: '{}' } }],
        },
      }],
    }, 'm');
    expect(out.message.tool_calls[0].function.name).toBe('file_list');
    expect(out.finish_reason).toBe('tool_calls');
  });
});

describe('VllmService.streamChat tool_calls', () => {
  test('accumulates streamed tool_calls', async () => {
    const { EventEmitter } = require('events');
    const stream = new EventEmitter();
    const svc = new VllmService({ VLLM_HOST: 'http://127.0.0.1:9', VLLM_DEFAULT_MODEL: 'm' });
    let posted;
    const ready = new Promise((r) => { posted = r; });
    svc.http = {
      post: async () => {
        posted();
        return { data: stream };
      },
    };
    svc.listModels = async () => [{ name: 'm', max_model_len: 4096 }];
    const p = svc.streamChat({ model: 'm', messages: [{ role: 'user', content: 'ls' }], tools: [] }, {});
    await ready;
    await new Promise((r) => setImmediate(r));
    stream.emit('data', Buffer.from('data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"file_","arguments":""}}]}}]}\n'));
    stream.emit('data', Buffer.from('data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"list","arguments":"{}"}}]},"finish_reason":"tool_calls"}]}\n'));
    stream.emit('end');
    const out = await p;
    expect(out.message.tool_calls[0].function.name).toBe('file_list');
    expect(out.finish_reason).toBe('tool_calls');
  });
});
