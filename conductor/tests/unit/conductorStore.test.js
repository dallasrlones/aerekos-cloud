'use strict';

describe('ConductorStore', () => {
  test('SqliteStore.init does not recurse into initializeDatabase via create', async () => {
    const { SqliteStore, createConductorStore } = require('../../api/store/ConductorStore');
    const store = createConductorStore();
    expect(store).toBeInstanceOf(SqliteStore);
    expect(store.path()).toBeTruthy();
    // dbInit calls createConductorStore() only — never store.init()
    const dbInit = require('../../api/utils/dbInit');
    const src = require('fs').readFileSync(require.resolve('../../api/utils/dbInit'), 'utf8');
    expect(src).toMatch(/createConductorStore\(\)/);
    expect(src).not.toMatch(/store\.init\(/);
    expect(typeof dbInit.initializeDatabase).toBe('function');
  });

  test('non-sqlite CONDUCTOR_STORE throws', () => {
    const prev = process.env.CONDUCTOR_STORE;
    process.env.CONDUCTOR_STORE = 'postgres';
    jest.resetModules();
    const { createConductorStore } = require('../../api/store/ConductorStore');
    expect(() => createConductorStore()).toThrow(/not implemented/);
    process.env.CONDUCTOR_STORE = prev;
    jest.resetModules();
  });
});
