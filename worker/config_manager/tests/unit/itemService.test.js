require('../setup');
require('../../api/models');
const { ItemService } = require('../../api/services/ItemService');

describe('ItemService', () => {
  const service = new ItemService();

  test('ensureDefaults creates app namespace once', async () => {
    const pid = 'p-unit-defaults-' + Date.now();
    const first = await service.ensureDefaults(pid);
    expect(first.created).toBe(true);
    expect(first.item.name).toBe('app');
    expect(JSON.parse(first.item.flags)).toEqual({ example: false });

    const second = await service.ensureDefaults(pid);
    expect(second.created).toBe(false);
    expect(second.item.id).toBe(first.item.id);
  });

  test('evaluate reads stored flags and defaults missing to false', async () => {
    const pid = 'p-unit-eval-' + Date.now();
    await service.create({
      project_id: pid,
      name: 'app',
      flags: JSON.stringify({ beta: true }),
    });

    const hit = await service.evaluate(pid, { namespace: 'app', flag: 'beta' });
    expect(hit).toEqual({ namespace: 'app', flag: 'beta', value: true });

    const miss = await service.evaluate(pid, { namespace: 'app', flag: 'nope' });
    expect(miss.value).toBe(false);

    const missingNs = await service.evaluate(pid, { namespace: 'other', flag: 'beta' });
    expect(missingNs.value).toBe(false);
  });
});
