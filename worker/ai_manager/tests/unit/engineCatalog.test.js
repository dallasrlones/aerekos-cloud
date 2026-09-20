'use strict';

const {
  catalogList,
  getKind,
  resolveEndpoint,
  mayAutoStart,
  integrationNames,
} = require('../../api/services/engineCatalog');

describe('engineCatalog', () => {
  test('lists Cloud engines including ollama and xtts', () => {
    const kinds = catalogList().map((c) => c.kind);
    expect(kinds).toEqual(expect.arrayContaining([
      'vllm', 'ollama', 'stt', 'tts_kokoro', 'tts_xtts', 'tts_cache', 'icarus_workspace', 'icarus_browser',
    ]));
  });

  test('vllm xtts ollama never auto-start', () => {
    expect(mayAutoStart('vllm')).toBe(false);
    expect(mayAutoStart('tts_xtts')).toBe(false);
    expect(mayAutoStart('ollama')).toBe(false);
    expect(mayAutoStart('stt')).toBe(true);
  });

  test('same-host endpoint uses host.docker.internal', () => {
    const worker = { id: 'orin', ip_address: '192.168.0.221' };
    expect(resolveEndpoint('stt', worker, 'orin')).toBe('http://host.docker.internal:8001');
  });

  test('other-host endpoint uses worker LAN IP', () => {
    const worker = { id: 'gpu-b', ip_address: '192.168.0.50' };
    expect(resolveEndpoint('tts_kokoro', worker, 'orin')).toBe('http://192.168.0.50:8013');
  });

  test('ollama upserts embeddings too', () => {
    expect(integrationNames('ollama')).toEqual(['orin-ollama', 'orin-embeddings']);
  });

  test('unknown kind is 400', () => {
    expect(() => getKind('nope')).toThrow(/unknown engine kind/);
  });
});
