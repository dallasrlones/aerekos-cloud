'use strict';

jest.mock('../../api/services/StackService', () => ({
  record: jest.fn(),
  current: jest.fn(),
  put: jest.fn(),
}));

jest.mock('../../api/services/ServiceManager', () => ({
  getInstance: jest.fn(),
}));

const StackService = require('../../api/services/StackService');
const ServiceManager = require('../../api/services/ServiceManager');
const { IdeAttachService, fnNameFromPath } = require('../../api/services/IdeAttachService');

describe('IdeAttachService', () => {
  afterEach(() => jest.restoreAllMocks());

  test('fnNameFromPath sanitizes file names', () => {
    expect(fnNameFromPath('src/api/handler.ts')).toBe('handler');
  });

  test('attachAsFunction returns ASK until confirm', async () => {
    const svc = new IdeAttachService();
    const out = await svc.attachAsFunction({
      projectId: 'p1',
      repoId: 'r1',
      path: 'index.js',
      ref: 'main',
      token: 'tok',
      preview: true,
    });
    expect(out.ask).toBe(true);
    expect(out.kind).toBe('attach_function');
    expect(out.plan.function.name).toBe('index');
  });

  test('attachAsFunction records stack revision on confirm', async () => {
    jest.spyOn(StackService, 'record').mockResolvedValue({ revision: 7, status: 'draft' });
    const proxy = jest.fn(async (service, method) => {
      if (service === 'git_manager') {
        return { status: 200, data: { content: 'exports.handler = () => 1' } };
      }
      if (service === 'function_manager' && method === 'POST') {
        return { status: 201, data: { function: { id: 'f1', name: 'index' } } };
      }
      return { status: 200, data: {} };
    });

    const svc = new IdeAttachService({ proxy });
    const out = await svc.attachAsFunction({
      projectId: 'p1',
      repoId: 'r1',
      path: 'index.js',
      ref: 'main',
      token: 'tok',
      confirm: true,
    });
    expect(out.attached).toBe(true);
    expect(out.stack_revision).toBe(7);
    expect(StackService.record).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ service: 'function_manager', key: 'functions' }),
    );
  });

  test('exposeViaApi records routes via StackService', async () => {
    jest.spyOn(StackService, 'record').mockResolvedValue({ revision: 3, status: 'draft' });
    const proxy = jest.fn(async (service, method) => {
      if (service === 'api_manager' && method === 'POST') {
        return { status: 201, data: { item: { id: 'e1', name: 'ide-index' } } };
      }
      return { status: 200, data: {} };
    });

    const svc = new IdeAttachService({ proxy });
    const out = await svc.exposeViaApi({
      projectId: 'p1',
      repoId: 'r1',
      path: 'routes/index.js',
      ref: 'main',
      token: 'tok',
      confirm: true,
    });
    expect(out.exposed).toBe(true);
    expect(StackService.record).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ service: 'api_manager', key: 'routes' }),
    );
  });
});
