'use strict';

const store = { rows: [] };

jest.mock('../../api/models', () => ({
  ProjectEnvironment: {
    findAll: jest.fn(async ({ where } = {}) => store.rows.filter((r) => {
      if (where?.project_id && r.project_id !== where.project_id) return false;
      if (where?.name && r.name !== where.name) return false;
      return true;
    })),
    create: jest.fn(async (row) => {
      const created = { id: `env-${row.name}`, ...row, created_at: 'now', updated_at: 'now' };
      store.rows.push(created);
      return created;
    }),
  },
  Project: {
    findAll: jest.fn(async () => [
      { id: '9d8bde11-6933-4732-b746-602dcf72eaa5', name: 'system' },
      { id: 'app-1', name: 'demo' },
    ]),
  },
}));

jest.mock('../../api/config/systemProject', () => ({
  isSystemProject: (id) => id === '9d8bde11-6933-4732-b746-602dcf72eaa5',
}));

const EnvironmentService = require('../../api/services/EnvironmentService');
const { stripSecretEnv } = EnvironmentService;

describe('EnvironmentService.ensureForProject', () => {
  beforeEach(() => {
    store.rows = [];
  });

  test('system creates prod only', async () => {
    const list = await EnvironmentService.ensureForProject('9d8bde11-6933-4732-b746-602dcf72eaa5', 'system');
    expect(list.map((e) => e.name)).toEqual(['prod']);
  });

  test('new app project creates only the picked env', async () => {
    const list = await EnvironmentService.ensureForProject('app-1', 'demo', { envName: 'dev' });
    expect(list.map((e) => e.name)).toEqual(['dev']);
    expect(list[0].git_ref).toBe('develop');
  });

  test('does not backfill a second env on existing app project', async () => {
    await EnvironmentService.ensureForProject('app-1', 'demo', { envName: 'dev' });
    const again = await EnvironmentService.ensureForProject('app-1', 'demo', { envName: 'prod' });
    expect(again.map((e) => e.name)).toEqual(['dev']);
  });

  test('ensureAll only touches system', async () => {
    await EnvironmentService.ensureAll();
    expect(store.rows.every((r) => r.project_id === '9d8bde11-6933-4732-b746-602dcf72eaa5')).toBe(true);
    expect(store.rows.map((r) => r.name)).toEqual(['prod']);
  });
});

describe('stripSecretEnv', () => {
  test('drops secret-looking keys', () => {
    expect(stripSecretEnv({
      PORT: '8080',
      DATABASE_PASSWORD: 'x',
      API_TOKEN: 't',
      PUBLIC_URL: 'https://x',
    })).toEqual({ PORT: '8080', PUBLIC_URL: 'https://x' });
  });
});
