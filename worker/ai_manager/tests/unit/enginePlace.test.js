'use strict';

jest.mock('../../api/models', () => ({
  AiEngine: {},
  AiModelConfig: {},
}));

const { EngineService } = require('../../api/services/EngineService');

function svc(overrides = {}) {
  const engines = [];
  const models = [
    { id: 'm1', name: 'orin-stt', endpoint: 'http://host.docker.internal:8001' },
    { id: 'm2', name: 'orin-stt', endpoint: 'http://old' },
  ];
  const s = new EngineService({
    Engine: {
      findAll: async ({ where } = {}) => {
        if (!where) return engines.slice();
        return engines.filter((e) => Object.entries(where).every(([k, v]) => e[k] === v));
      },
      create: async (row) => {
        const out = { id: `e${engines.length + 1}`, ...row };
        engines.push(out);
        return out;
      },
      update: async (id, patch) => {
        const row = engines.find((e) => e.id === id);
        if (row) Object.assign(row, patch);
        return row;
      },
    },
    Model: {
      findAll: async () => models,
      update: async (id, patch) => {
        const row = models.find((m) => m.id === id);
        if (row) Object.assign(row, patch);
      },
    },
    docker: { info: async () => ({ Name: 'ubuntu' }) },
    fetchFn: async () => ({ status: 200, json: async () => ({}) }),
    ...overrides,
  });
  s.listWorkers = async () => ([
    { id: 'orin', hostname: 'ubuntu', display_name: 'orin', ip_address: '192.168.0.221' },
  ]);
  s.localWorkerId = async () => 'orin';
  return { s, engines, models };
}

describe('EngineService.place', () => {
  test('refuses to auto-start a missing vLLM', async () => {
    const { s } = svc();
    s.inspectNamed = async () => null;
    await expect(s.place({ kind: 'vllm', worker_id: 'orin' })).rejects.toMatchObject({
      status: 409,
      code: 'NO_AUTO_START',
    });
  });

  test('adopts a running STT and retargets integrations', async () => {
    const { s, models } = svc();
    s.inspectNamed = async () => ({
      name: 'aerekos-stt',
      info: { id: 'cid', running: true },
    });
    const out = await s.place({ kind: 'stt', worker_id: 'orin' });
    expect(out.status).toBe('running');
    expect(out.endpoint).toBe('http://host.docker.internal:8001');
    expect(models[1].endpoint).toBe('http://host.docker.internal:8001');
  });

  test('records stopped XTTS without starting it', async () => {
    const { s } = svc();
    s.startNamed = jest.fn();
    s.inspectNamed = async () => ({
      name: 'tts-service',
      info: { id: 'x', running: false, state: 'exited' },
    });
    const out = await s.place({ kind: 'tts_xtts', worker_id: 'orin' });
    expect(out.status).toBe('stopped');
    expect(s.startNamed).not.toHaveBeenCalled();
  });
});
