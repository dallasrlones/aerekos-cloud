'use strict';

const { BackupScheduler } = require('../../api/services/BackupScheduler');

describe('BackupScheduler git source', () => {
  test('tick creates jobs for git and storage targets', async () => {
    const created = [];
    const jobService = {
      create: jest.fn(async (row) => {
        created.push(row);
        return row;
      }),
    };
    const scheduler = new BackupScheduler({ jobService, itemService: {} });
    jest.isolateModules(() => {});
    const models = require('../../api/models');
    jest.spyOn(models.Item, 'findAll').mockResolvedValue([
      { project_id: 'p1', name: 'v1', schedule: '* * * * *', targets: 'storage,git' },
    ]);
    await scheduler.tick();
    const sources = created.map((c) => c.source);
    expect(sources).toEqual(expect.arrayContaining(['storage', 'git']));
  });
});
