const { IaModuleService } = require('../../api/services/IaModuleService');

describe('code_as_infra IaModuleService validation', () => {
  const s = new IaModuleService();

  test('create requires project_id', async () => {
    await expect(s.create({ name: 'm1' })).rejects.toMatchObject({
      message: 'project_id required',
      status: 400,
    });
  });

  test('create requires name', async () => {
    await expect(s.create({ project_id: 'p1', name: '  ' })).rejects.toMatchObject({
      message: 'name required',
      status: 400,
    });
  });

  test('list requires project_id', async () => {
    await expect(s.list('')).rejects.toMatchObject({
      message: 'project_id required',
      status: 400,
    });
  });
});
