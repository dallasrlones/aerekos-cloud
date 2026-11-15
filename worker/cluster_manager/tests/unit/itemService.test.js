const { ItemService } = require('../../api/services/ItemService');

describe('ItemService.ensureDefaults', () => {
  const service = new ItemService();

  test('creates default k3s cluster when empty', async () => {
    const pid = 'p-cluster-unit-' + Date.now();
    const first = await service.ensureDefaults(pid);
    expect(first.created).toBe(true);
    expect(first.item.name).toBe('k3s');
    const second = await service.ensureDefaults(pid);
    expect(second.created).toBe(false);
    expect(second.item.id).toBe(first.item.id);
  });
});
