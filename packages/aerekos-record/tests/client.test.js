'use strict';

const { createRecordClient } = require('../index');

test('createRecordClient scaffold', async () => {
  const c = createRecordClient({ dialect: 'sqlite' });
  expect(c.dialect).toBe('sqlite');
  await expect(c.ping()).resolves.toEqual({ ok: true, scaffold: true });
});
