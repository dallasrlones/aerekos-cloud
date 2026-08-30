'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');

process.env.NODE_ENV = 'test';
process.env.SKIP_SERVICE_REGISTRATION = 'true';
if (!process.env.DATABASE_PATH) {
  const dir = path.join(os.tmpdir(), 'aerekos-gql-defaults');
  fs.mkdirSync(dir, { recursive: true });
  process.env.DATABASE_PATH = path.join(dir, `t_${Date.now()}.db`);
}

jest.mock('../../../shared/conductorProxy', () => ({
  proxy: jest.fn(async () => ({ ok: true })),
}));

const { ItemService } = require('../../api/services/ItemService');
const { proxy } = require('../../../shared/conductorProxy');

describe('GraphQL ensureDefaults', () => {
  test('creates app schema with User/Post and data_app=app', async () => {
    const svc = new ItemService();
    const pid = `gql-${Date.now()}`;
    const out = await svc.ensureDefaults(pid);
    expect(out.created).toBe(true);
    expect(out.item.name).toBe('app');
    expect(out.item.data_app).toBe('app');
    expect(String(out.item.schema || '')).toMatch(/User|type/);
    expect(proxy).toHaveBeenCalledWith(expect.objectContaining({
      service: 'api_manager',
      path: '/api/v1/data-apis/apply',
    }));
  });
});
