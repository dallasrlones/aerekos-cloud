const { ItemService } = require('../../api/services/ItemService');

describe('ItemService.ensureDefaults', () => {
  const service = new ItemService();

  test('creates default app channel when empty', async () => {
    const pid = 'p-ws-unit-' + Date.now();
    const first = await service.ensureDefaults(pid);
    expect(first.created).toBe(true);
    expect(first.item.name).toBe('app');
    const second = await service.ensureDefaults(pid);
    expect(second.created).toBe(false);
    expect(second.item.id).toBe(first.item.id);
  });
});
