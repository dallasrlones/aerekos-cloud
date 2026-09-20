'use strict';

const { buildServeCmd, parseParamsB, parseServeCmd } = require('../../api/services/VllmServeService');

describe('VllmServeService command', () => {
  test('builds serve flags with 0.90 GPU util by default', () => {
    const cmd = buildServeCmd('shawnw3i/Huihui-Qwen3.8-27B-abliterated-AWQ-MTP', {});
    expect(cmd[0]).toBe('vllm');
    expect(cmd[1]).toBe('serve');
    expect(cmd).toContain('--gpu-memory-utilization');
    expect(cmd[cmd.indexOf('--gpu-memory-utilization') + 1]).toBe('0.9');
    expect(cmd).toContain('--quantization');
    expect(cmd).toContain('awq');
  });

  test('parses largest B count from Huihui Qwen3.8 27B id', () => {
    expect(parseParamsB('shawnw3i/Huihui-Qwen3.8-27B-abliterated-AWQ-MTP')).toBe(27);
  });

  test('parseServeCmd reads live util and max-model-len (not 0.90/8192)', () => {
    const live = [
      'vllm', 'serve', 'shawnw3i/Huihui-Qwen3.8-27B-abliterated-AWQ-MTP',
      '--gpu-memory-utilization', '0.62',
      '--max-model-len', '4096',
      '--quantization', 'awq',
      '--enable-prefix-caching',
      '--enforce-eager',
    ];
    const parsed = parseServeCmd(live);
    expect(parsed.gpu_memory_utilization).toBe(0.62);
    expect(parsed.max_model_len).toBe(4096);
    const cmd = buildServeCmd('shawnw3i/Huihui-Qwen3.8-27B-abliterated-AWQ-MTP', parsed);
    expect(cmd[cmd.indexOf('--gpu-memory-utilization') + 1]).toBe('0.62');
    expect(cmd[cmd.indexOf('--max-model-len') + 1]).toBe('4096');
  });
});
